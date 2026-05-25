package com.example.whispertranscriber

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.whispertranscriber.service.TranscriptionService
import com.example.whispertranscriber.ui.HistoryAdapter
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.progressindicator.LinearProgressIndicator
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    // ===== Views =====
    private lateinit var statusCard: MaterialCardView
    private lateinit var statusText: TextView
    private lateinit var stateIcon: TextView
    private lateinit var latestTranscriptionText: TextView
    private lateinit var levelIndicator: LinearProgressIndicator
    private lateinit var startStopButton: MaterialButton
    private lateinit var historyRecycler: RecyclerView
    private lateinit var emptyHistoryText: TextView

    private val adapter = HistoryAdapter { result ->
        showDeleteDialog(result)
    }

    // ===== Service 接続 =====
    private var service: TranscriptionService? = null
    private var isBound = false
    private val history = mutableListOf<TranscriptionService.TranscriptionResult>()

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service = (binder as TranscriptionService.LocalBinder).getService()
            isBound = true
            observeService()
        }
        override fun onServiceDisconnected(name: ComponentName) {
            service = null
            isBound = false
        }
    }

    // ===== パーミッション =====
    private val requestPermissionsLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            val micGranted = grants[Manifest.permission.RECORD_AUDIO] == true
            if (micGranted) {
                startTranscriptionService()
            } else {
                showPermissionRationale()
            }
        }

    // ===== ライフサイクル =====

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        bindViews()
        setupRecyclerView()
        setupButtons()
        updateUi(TranscriptionService.ServiceState.Idle())
    }

    override fun onStart() {
        super.onStart()
        // 既に Service が動いていればバインド
        bindService(
            Intent(this, TranscriptionService::class.java),
            serviceConnection,
            Context.BIND_AUTO_CREATE,
        )
    }

    override fun onStop() {
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
        super.onStop()
    }

    // ===== View セットアップ =====

    private fun bindViews() {
        statusCard              = findViewById(R.id.card_status)
        statusText              = findViewById(R.id.text_status)
        stateIcon               = findViewById(R.id.text_state_icon)
        latestTranscriptionText = findViewById(R.id.text_latest_transcription)
        levelIndicator          = findViewById(R.id.level_indicator)
        startStopButton         = findViewById(R.id.button_start_stop)
        historyRecycler         = findViewById(R.id.recycler_history)
        emptyHistoryText        = findViewById(R.id.text_empty_history)
    }

    private fun setupRecyclerView() {
        historyRecycler.adapter = adapter
        historyRecycler.layoutManager = LinearLayoutManager(this)
    }

    private fun setupButtons() {
        startStopButton.setOnClickListener {
            if (service == null || service?.serviceState?.value is TranscriptionService.ServiceState.Idle) {
                checkAndRequestPermissions()
            } else {
                stopTranscriptionService()
            }
        }
    }

    // ===== Service 観察 =====

    private fun observeService() {
        val svc = service ?: return

        lifecycleScope.launch {
            svc.serviceState.collect { state ->
                updateUi(state)
            }
        }

        lifecycleScope.launch {
            svc.latestResult.collect { result ->
                result ?: return@collect
                history.add(0, result)
                adapter.submitList(history.toList())
                updateHistoryVisibility()
                latestTranscriptionText.text = result.text
            }
        }

        lifecycleScope.launch {
            svc.audioLevel.collect { db ->
                // -60dB〜0dB を 0〜100 に変換
                val progress = ((db + 60f) / 60f * 100f).coerceIn(0f, 100f).toInt()
                levelIndicator.setProgressCompat(progress, true)
            }
        }
    }

    // ===== UI 更新 =====

    private fun updateUi(state: TranscriptionService.ServiceState) {
        when (state) {
            is TranscriptionService.ServiceState.Initializing -> {
                stateIcon.text = "⏳"
                statusText.text = "モデル読み込み中..."
                startStopButton.text = "停止"
                startStopButton.isEnabled = true
                levelIndicator.visibility = View.GONE
            }
            is TranscriptionService.ServiceState.Idle -> {
                stateIcon.text = "⏸️"
                statusText.text = "停止中"
                startStopButton.text = "開始"
                startStopButton.isEnabled = true
                levelIndicator.visibility = View.GONE
            }
            is TranscriptionService.ServiceState.Listening -> {
                stateIcon.text = "👂"
                statusText.text = "待機中"
                startStopButton.text = "停止"
                startStopButton.isEnabled = true
                levelIndicator.visibility = View.VISIBLE
            }
            is TranscriptionService.ServiceState.Recording -> {
                stateIcon.text = "🔴"
                statusText.text = "録音中"
                startStopButton.text = "停止"
                startStopButton.isEnabled = true
                levelIndicator.visibility = View.VISIBLE
            }
            is TranscriptionService.ServiceState.Transcribing -> {
                stateIcon.text = "📝"
                statusText.text = "文字起こし中 (%.1fs)".format(state.durationSec)
                startStopButton.text = "停止"
                startStopButton.isEnabled = true
                levelIndicator.visibility = View.GONE
            }
            is TranscriptionService.ServiceState.Error -> {
                stateIcon.text = "⚠️"
                statusText.text = "エラー: ${state.message}"
                startStopButton.text = "開始"
                startStopButton.isEnabled = true
                levelIndicator.visibility = View.GONE
            }
        }
    }

    private fun updateHistoryVisibility() {
        if (history.isEmpty()) {
            emptyHistoryText.visibility = View.VISIBLE
            historyRecycler.visibility = View.GONE
        } else {
            emptyHistoryText.visibility = View.GONE
            historyRecycler.visibility = View.VISIBLE
        }
    }

    // ===== Service 起動/停止 =====

    private fun startTranscriptionService() {
        val intent = Intent(this, TranscriptionService::class.java).apply {
            action = TranscriptionService.ACTION_START
        }
        ContextCompat.startForegroundService(this, intent)
        // バインドして観察
        bindService(
            Intent(this, TranscriptionService::class.java),
            serviceConnection,
            Context.BIND_AUTO_CREATE,
        )
    }

    private fun stopTranscriptionService() {
        service?.stopListening()
    }

    // ===== パーミッション =====

    private fun checkAndRequestPermissions() {
        val permissions = buildList {
            if (!hasPermission(Manifest.permission.RECORD_AUDIO))
                add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                !hasPermission(Manifest.permission.POST_NOTIFICATIONS))
                add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (permissions.isEmpty()) {
            startTranscriptionService()
        } else {
            requestPermissionsLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun hasPermission(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun showPermissionRationale() {
        AlertDialog.Builder(this)
            .setTitle("マイクのアクセス許可が必要です")
            .setMessage("音声文字起こしにはマイクへのアクセスが必要です。設定から許可してください。")
            .setPositiveButton("設定を開く") { _, _ ->
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                    startActivity(this)
                }
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }

    // ===== 履歴操作 =====

    private fun showDeleteDialog(result: TranscriptionService.TranscriptionResult) {
        AlertDialog.Builder(this)
            .setTitle("削除")
            .setMessage("この文字起こし結果を削除しますか？\n\n${result.text.take(80)}")
            .setPositiveButton("削除") { _, _ ->
                history.removeAll { it.timestamp == result.timestamp }
                adapter.submitList(history.toList())
                updateHistoryVisibility()
                Toast.makeText(this, "削除しました", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
}
