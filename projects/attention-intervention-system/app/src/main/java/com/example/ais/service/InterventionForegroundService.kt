package com.example.ais.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.IBinder
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.example.ais.MainActivity
import com.example.ais.R
import com.example.ais.data.dao.GoalDao
import com.example.ais.data.dao.InterventionLogDao
import com.example.ais.data.entity.Goal
import com.example.ais.data.entity.InterventionLog
import com.example.ais.overlay.GoalOverlayManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Hard モード専用の Foreground Service。
 *
 * ## 役割
 * 1. ACTION_SCREEN_ON を動的登録した BroadcastReceiver を保持する
 *    （Android 8.0以降、ACTION_SCREEN_ON は動的登録のみ受信可能）
 * 2. SCREEN_ON 受信時に GoalOverlayManager でオーバーレイを表示する
 *    （Android 10+のバックグラウンドActivity起動制限を回避）
 * 3. Foreground 通知は「静かな通知チャンネル」で存在感を最小化
 *
 * ## Android バージョン別の制約対応
 * - Android 10+ : バックグラウンドからの Activity 起動不可 → Overlay で代替
 * - Android 12+ : SCHEDULE_EXACT_ALARM 権限が必要
 * - Android 13+ : POST_NOTIFICATIONS 権限が必要
 * - Android 14+ : foregroundServiceType="specialUse" の明示が必須
 *
 * ## Overlay 権限 (SYSTEM_ALERT_WINDOW) について
 * - ユーザーが Settings > アプリ > 他のアプリの上に表示 から許可する必要がある
 * - Play Store 審査で用途説明が求められる（ただし拒否されるケースは少ない）
 * - 権限なし時はオーバーレイ表示をスキップし、通知のみにフォールバック
 */
@AndroidEntryPoint
class InterventionForegroundService : Service() {

    @Inject lateinit var goalDao: GoalDao
    @Inject lateinit var logDao: InterventionLogDao

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var overlayManager: GoalOverlayManager
    private var screenOnReceiver: BroadcastReceiver? = null

    // ── Lifecycle ──────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        overlayManager = GoalOverlayManager(applicationContext)
        startForegroundWithNotification()
        registerScreenOnReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: OSがサービスを殺しても再起動させる
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        unregisterScreenOnReceiver()
        overlayManager.dismiss()
        serviceScope.cancel()
    }

    // ── Foreground Notification ────────────────────────────

    private fun startForegroundWithNotification() {
        createServiceChannel()

        val tapIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_goal)
            .setContentTitle("AIS 実行中")
            .setContentText("画面ON時に目標を表示します")
            .setPriority(NotificationCompat.PRIORITY_MIN)   // 最低優先度（通知欄の最下部）
            .setVisibility(NotificationCompat.VISIBILITY_SECRET) // ロック画面には非表示
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(tapIntent)
            .build()

        startForeground(SERVICE_NOTIFICATION_ID, notification)
    }

    private fun createServiceChannel() {
        val channel = NotificationChannel(
            SERVICE_CHANNEL_ID,
            "AIS バックグラウンド",
            // IMPORTANCE_MIN: ヘッドアップ通知なし、サウンドなし、通知欄最下部
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "Hard モード実行中の常駐通知（非表示設定可能）"
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    // ── ScreenOn BroadcastReceiver ─────────────────────────

    /**
     * ACTION_SCREEN_ON は動的登録のみ有効（Android 8.0以降 Manifest 登録では受信不可）。
     * Foreground Service 内で登録することで、プロセスが生きている限り受信できる。
     */
    private fun registerScreenOnReceiver() {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != Intent.ACTION_SCREEN_ON) return
                handleScreenOn()
            }
        }
        val filter = IntentFilter(Intent.ACTION_SCREEN_ON)
        registerReceiver(receiver, filter)
        screenOnReceiver = receiver
    }

    private fun unregisterScreenOnReceiver() {
        screenOnReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
            screenOnReceiver = null
        }
    }

    // ── Screen ON 処理 ────────────────────────────────────

    private fun handleScreenOn() {
        serviceScope.launch {
            // 頻度チェック（SCREEN_ON 専用カウンターを使用）
            val lastScreenOn = logDao.getLatestScreenOn()
            val todayCount = logDao.countScreenOnByDate(Goal.todayKey())

            if (!InterventionLog.canInterveneNow(lastScreenOn, todayCount)) return@launch

            // 目標を取得
            val goals = goalDao.getActiveGoals().map { it.text }
            if (goals.all { it.isBlank() }) return@launch

            // ログを記録
            logDao.insert(InterventionLog.screenOn())

            // Overlay表示（権限あり）/ スキップ（権限なし）
            if (hasOverlayPermission()) {
                overlayManager.show(goals)
            }
            // 権限なし時は通知がすでに表示されているので何もしない
        }
    }

    private fun hasOverlayPermission(): Boolean =
        Settings.canDrawOverlays(applicationContext)

    // ── Static helpers ────────────────────────────────────

    companion object {
        const val SERVICE_CHANNEL_ID = "ais_service"
        const val SERVICE_NOTIFICATION_ID = 9001

        fun start(context: Context) {
            val intent = Intent(context, InterventionForegroundService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, InterventionForegroundService::class.java)
            context.stopService(intent)
        }
    }
}
