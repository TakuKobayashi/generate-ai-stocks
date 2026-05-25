package com.example.whispertranscriber.audio

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.ByteArrayOutputStream

/**
 * AudioRecord + VadDetector を統合した録音クラス
 * VAD で音声区間のみを検出し、コールバックで通知する
 */
class AudioRecorder(
    private val sampleRate: Int = 16000,
    private val vadSensitivity: VadDetector.Sensitivity = VadDetector.Sensitivity.AGGRESSIVE,
) {

    companion object {
        private const val TAG = "AudioRecorder"
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT

        // 最小/最大録音時間
        private const val MIN_RECORDING_SEC = 1.0f
        private const val MAX_RECORDING_SEC = 60.0f
    }

    // 録音状態
    sealed class RecordingState {
        object Idle : RecordingState()
        object Listening : RecordingState()
        object Recording : RecordingState()
        data class Error(val message: String) : RecordingState()
    }

    // 録音セッション
    data class RecordingSession(
        val pcmData: ByteArray,
        val durationSeconds: Float,
        val timestamp: Long = System.currentTimeMillis(),
    )

    // コールバック
    var onVoiceStart: (() -> Unit)? = null
    var onVoiceEnd: ((session: RecordingSession) -> Unit)? = null
    var onTooShort: ((durationSeconds: Float) -> Unit)? = null
    var onLevelUpdate: ((db: Float) -> Unit)? = null
    var onError: ((message: String) -> Unit)? = null

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val vad = VadDetector(sampleRate, vadSensitivity)

    private val _state = MutableStateFlow<RecordingState>(RecordingState.Idle)
    val state: StateFlow<RecordingState> = _state

    @Volatile
    private var isRunning = false

    // 録音バッファ
    private var sessionBuffer: ByteArrayOutputStream? = null
    private var sessionStartTime = 0L

    // プリロールバッファ（音声開始直前の音声を含めるため）
    private val preRollMaxFrames = 15  // 150ms
    private val preRollBuffer = ArrayDeque<ByteArray>()

    /**
     * 監視開始
     * @throws SecurityException マイクパーミッションがない場合
     */
    @Throws(SecurityException::class)
    fun start() {
        if (isRunning) return

        val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT)
        val bufferSize = maxOf(minBufferSize * 4, vad.frameBytes * 8)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRate,
            CHANNEL_CONFIG,
            AUDIO_FORMAT,
            bufferSize,
        )

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            val msg = "AudioRecord の初期化失敗"
            Log.e(TAG, msg)
            _state.value = RecordingState.Error(msg)
            onError?.invoke(msg)
            return
        }

        isRunning = true
        audioRecord?.startRecording()
        _state.value = RecordingState.Listening
        vad.reset()

        recordingThread = Thread({ captureLoop() }, "AudioCapture").apply {
            priority = Thread.MAX_PRIORITY
            isDaemon = true
            start()
        }

        Log.i(TAG, "録音監視開始")
    }

    /**
     * 監視停止
     */
    fun stop() {
        isRunning = false

        // 録音中だった場合はセッションを強制終了
        sessionBuffer?.let { buf ->
            if (buf.size() > 0) {
                finalizeSession(buf.toByteArray())
            }
        }

        recordingThread?.join(2000)
        recordingThread = null

        audioRecord?.apply {
            stop()
            release()
        }
        audioRecord = null
        sessionBuffer = null
        preRollBuffer.clear()

        _state.value = RecordingState.Idle
        Log.i(TAG, "録音監視停止")
    }

    // ===== 録音ループ =====

    private fun captureLoop() {
        val readBuffer = ByteArray(vad.frameBytes)

        while (isRunning) {
            val read = audioRecord?.read(readBuffer, 0, vad.frameBytes) ?: break
            if (read <= 0) continue

            val frame = if (read == vad.frameBytes) readBuffer.clone()
                        else readBuffer.copyOf(read)

            try {
                processFrame(frame)
            } catch (e: Exception) {
                Log.e(TAG, "フレーム処理エラー: ${e.message}")
            }
        }
    }

    private fun processFrame(frame: ByteArray) {
        val result = vad.processFrame(frame)

        // 音量レベルを通知
        onLevelUpdate?.invoke(result.energyDb)

        // プリロールバッファ更新
        if (!result.isSpeech) {
            preRollBuffer.addLast(frame.clone())
            if (preRollBuffer.size > preRollMaxFrames) {
                preRollBuffer.removeFirst()
            }
        }

        when {
            result.started -> {
                // 録音開始
                sessionBuffer = ByteArrayOutputStream().apply {
                    // プリロールを先頭に書き込む
                    preRollBuffer.forEach { write(it) }
                    write(frame)
                }
                preRollBuffer.clear()
                sessionStartTime = System.currentTimeMillis()
                _state.value = RecordingState.Recording
                onVoiceStart?.invoke()
                Log.d(TAG, "セッション開始")
            }

            result.stopped -> {
                // 録音終了
                sessionBuffer?.write(frame)
                val pcm = sessionBuffer?.toByteArray() ?: ByteArray(0)
                sessionBuffer = null
                _state.value = RecordingState.Listening
                finalizeSession(pcm)
            }

            result.isSpeech -> {
                // 録音中フレームを蓄積
                sessionBuffer?.write(frame)

                // 最大録音時間チェック
                val elapsed = (System.currentTimeMillis() - sessionStartTime) / 1000f
                if (elapsed >= MAX_RECORDING_SEC) {
                    Log.w(TAG, "最大録音時間に達したため強制終了")
                    val pcm = sessionBuffer?.toByteArray() ?: ByteArray(0)
                    sessionBuffer = null
                    _state.value = RecordingState.Listening
                    vad.reset()
                    finalizeSession(pcm)
                }
            }
        }
    }

    private fun finalizeSession(pcm: ByteArray) {
        val durationSec = pcm.size.toFloat() / (sampleRate * 2)  // 16bit = 2byte

        if (durationSec < MIN_RECORDING_SEC) {
            Log.d(TAG, "短すぎてスキップ: ${durationSec}s")
            onTooShort?.invoke(durationSec)
            return
        }

        Log.i(TAG, "セッション完了: ${durationSec}s, ${pcm.size} bytes")
        onVoiceEnd?.invoke(RecordingSession(pcm, durationSec))
    }
}
