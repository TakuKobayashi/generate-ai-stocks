package com.example.whispertranscriber.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.example.whispertranscriber.MainActivity
import com.example.whispertranscriber.R
import com.example.whispertranscriber.audio.AudioRecorder
import com.example.whispertranscriber.audio.VadDetector
import com.example.whispertranscriber.storage.FileManager
import com.example.whispertranscriber.whisper.ModelDownloader
import com.example.whispertranscriber.whisper.WhisperEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File

class TranscriptionService : LifecycleService() {

    companion object {
        private const val TAG = "TranscriptionService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "whisper_transcription"
        private const val MEMORY_CHECK_INTERVAL_MS = 60_000L

        const val ACTION_START = "com.example.whispertranscriber.START"
        const val ACTION_STOP  = "com.example.whispertranscriber.STOP"
    }

    inner class LocalBinder : Binder() {
        fun getService(): TranscriptionService = this@TranscriptionService
    }
    private val binder = LocalBinder()

    sealed class ServiceState {
        object Initializing : ServiceState()
        data class Idle(val message: String = "待機中") : ServiceState()
        object Listening : ServiceState()
        object Recording : ServiceState()
        data class Transcribing(val durationSec: Float) : ServiceState()
        data class Error(val message: String) : ServiceState()
    }

    data class TranscriptionResult(
        val text: String,
        val timestamp: Long,
        val durationSeconds: Float,
        val wavPath: String,
        val txtPath: String,
    )

    private val _serviceState = MutableStateFlow<ServiceState>(ServiceState.Idle())
    val serviceState: StateFlow<ServiceState> = _serviceState

    private val _latestResult = MutableStateFlow<TranscriptionResult?>(null)
    val latestResult: StateFlow<TranscriptionResult?> = _latestResult

    private val _audioLevel = MutableStateFlow(-100f)
    val audioLevel: StateFlow<Float> = _audioLevel

    private lateinit var whisperEngine: WhisperEngine
    private lateinit var audioRecorder: AudioRecorder
    private lateinit var fileManager: FileManager
    private lateinit var memoryMonitor: MemoryMonitor
    private var wakeLock: PowerManager.WakeLock? = null

    @Volatile private var isTranscribing = false
    private var transcribeJob: Job? = null
    private var memoryMonitorJob: Job? = null

    var language: String = "ja"
    var modelFile: File? = null

    override fun onCreate() {
        super.onCreate()
        whisperEngine  = WhisperEngine(this)
        fileManager    = FileManager(this)
        memoryMonitor  = MemoryMonitor(this)
        audioRecorder  = AudioRecorder(vadSensitivity = VadDetector.Sensitivity.AGGRESSIVE)
        setupAudioRecorderCallbacks()
        createNotificationChannel()
        startMemoryMonitoring()
        Log.i(TAG, "Service onCreate")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START -> lifecycleScope.launch { startListening() }
            ACTION_STOP  -> stopListening()
        }
        startForeground(NOTIFICATION_ID, buildNotification("初期化中..."))
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder {
        super.onBind(intent)
        return binder
    }

    override fun onDestroy() {
        stopListening()
        whisperEngine.release()
        wakeLock?.release()
        memoryMonitorJob?.cancel()
        Log.i(TAG, "Service onDestroy")
        super.onDestroy()
    }

    suspend fun startListening() {
        _serviceState.value = ServiceState.Initializing
        updateNotification("モデル読み込み中...")

        if (!whisperEngine.isReady) {
            val file = modelFile ?: run {
                val result = ModelDownloader.findOrCopyModel(this)
                when (result) {
                    is ModelDownloader.ModelResult.Found -> result.file
                    is ModelDownloader.ModelResult.Error -> {
                        _serviceState.value = ServiceState.Error(result.message)
                        updateNotification("エラー: モデルなし")
                        return
                    }
                }
            }
            val ok = whisperEngine.initialize(file)
            if (!ok) {
                _serviceState.value = ServiceState.Error("モデルの読み込みに失敗しました")
                updateNotification("エラー: モデル読み込み失敗")
                return
            }
        }

        acquireWakeLock()
        try {
            audioRecorder.start()
            _serviceState.value = ServiceState.Listening
            updateNotification("👂 待機中...")
        } catch (e: SecurityException) {
            _serviceState.value = ServiceState.Error("マイクのパーミッションがありません")
            updateNotification("エラー: マイクパーミッション")
        }
    }

    fun stopListening() {
        audioRecorder.stop()
        transcribeJob?.cancel()
        wakeLock?.release()
        wakeLock = null
        _serviceState.value = ServiceState.Idle()
        updateNotification("⏸ 停止中")
    }

    private fun setupAudioRecorderCallbacks() {
        audioRecorder.onVoiceStart = {
            _serviceState.value = ServiceState.Recording
            updateNotification("🔴 録音中...")
        }
        audioRecorder.onTooShort = { sec ->
            Log.d(TAG, "短すぎてスキップ: ${sec}s")
            _serviceState.value = ServiceState.Listening
            updateNotification("👂 待機中...")
        }
        audioRecorder.onLevelUpdate = { db -> _audioLevel.value = db }
        audioRecorder.onError = { msg ->
            Log.e(TAG, "AudioRecorder エラー: $msg")
            _serviceState.value = ServiceState.Error(msg)
            updateNotification("⚠ エラー")
        }
        audioRecorder.onVoiceEnd = { session ->
            if (!isTranscribing) {
                val durationSec = session.durationSeconds
                _serviceState.value = ServiceState.Transcribing(durationSec)
                updateNotification("📝 文字起こし中...")
                transcribeJob = lifecycleScope.launch(Dispatchers.IO) {
                    isTranscribing = true
                    try {
                        processSession(session.pcmData, durationSec)
                    } catch (e: Exception) {
                        Log.e(TAG, "セッション処理エラー: ${e.message}")
                    } finally {
                        isTranscribing = false
                        if (_serviceState.value is ServiceState.Transcribing) {
                            _serviceState.value = ServiceState.Listening
                            updateNotification("👂 待機中...")
                        }
                    }
                }
            } else {
                Log.w(TAG, "文字起こし処理中のためスキップ")
                _serviceState.value = ServiceState.Listening
                updateNotification("👂 待機中...")
            }
        }
    }

    private suspend fun processSession(pcmData: ByteArray, durationSec: Float) {
        val text = whisperEngine.transcribe(pcmData, language)
        if (text.isNullOrBlank()) {
            Log.d(TAG, "文字起こし結果が空でした")
            return
        }
        Log.i(TAG, "文字起こし完了: \"${text.take(50)}\"")
        val saved = fileManager.save(pcmData, text, durationSec) ?: return
        _latestResult.value = TranscriptionResult(
            text = text,
            timestamp = saved.timestamp,
            durationSeconds = durationSec,
            wavPath = saved.wavFile.absolutePath,
            txtPath = saved.txtFile.absolutePath,
        )
        updateNotification(text.take(40) + if (text.length > 40) "…" else "")
    }

    private fun startMemoryMonitoring() {
        memoryMonitorJob = lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                delay(MEMORY_CHECK_INTERVAL_MS)
                memoryMonitor.logStatus()
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "音声文字起こし", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "バックグラウンドで音声を文字起こしします"
            setShowBadge(false)
            enableLights(false)
            enableVibration(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(status: String) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("🎙️ Whisper 文字起こし")
            .setContentText(status)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setContentIntent(
                PendingIntent.getActivity(
                    this, 0, Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )
            )
            .addAction(
                android.R.drawable.ic_media_pause, "停止",
                PendingIntent.getService(
                    this, 1,
                    Intent(this, TranscriptionService::class.java).apply { action = ACTION_STOP },
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )
            )
            .build()

    private fun updateNotification(status: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(status))
    }

    private fun acquireWakeLock() {
        wakeLock?.release()
        wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$TAG:WakeLock")
            .apply { acquire(24 * 60 * 60 * 1000L) }
    }
}
