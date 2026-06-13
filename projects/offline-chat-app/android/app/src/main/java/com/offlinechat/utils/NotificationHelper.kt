package com.offlinechat.utils

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.offlinechat.OfflineChatApplication
import com.offlinechat.ui.MainActivity

class NotificationHelper(private val context: Context) {
    private val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun showMessage(title: String, text: String, chatRoomId: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            putExtra("chatRoomId", chatRoomId)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(context, chatRoomId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notif = NotificationCompat.Builder(context, OfflineChatApplication.CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()

        nm.notify(chatRoomId.hashCode(), notif)
    }

    fun showChatRequest(fromName: String) {
        val notif = NotificationCompat.Builder(context, OfflineChatApplication.CHANNEL_ID)
            .setContentTitle("チャットリクエスト")
            .setContentText("$fromName からチャットのリクエストが届きました")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .build()

        nm.notify(System.currentTimeMillis().toInt(), notif)
    }
}
