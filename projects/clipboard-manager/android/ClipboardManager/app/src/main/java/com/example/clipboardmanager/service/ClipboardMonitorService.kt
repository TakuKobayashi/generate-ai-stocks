package com.example.clipboardmanager.service

import android.app.*
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.clipboardmanager.MainActivity
import com.example.clipboardmanager.R
import com.example.clipboardmanager.data.AppDatabase
import kotlinx.coroutines.*

class ClipboardMonitorService : Service() {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var cm: ClipboardManager? = null
    private var lastContent: String? = null
    private lateinit var database: AppDatabase

    companion object {
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "clipboard_channel"

        fun start(context: Context) {
            val intent = Intent(context, ClipboardMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getDatabase(applicationContext)
        cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        cm?.addPrimaryClipChangedListener { handleClipboardChange() }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "クリップボード監視", NotificationManager.IMPORTANCE_LOW).apply {
                description = "クリップボードの変更を監視中"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("クリップボードマネージャー")
            .setContentText("監視中")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun handleClipboardChange() {
        scope.launch {
            val text = cm?.primaryClip?.getItemAt(0)?.text?.toString()
            if (!text.isNullOrEmpty() && text != lastContent) {
                lastContent = text
                withContext(Dispatchers.IO) { database.clipboardDao().insertOrUpdate(text) }
            }
        }
    }

    override fun onDestroy() { super.onDestroy(); scope.cancel() }
}
