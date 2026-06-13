package com.offlinechat

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context

class OfflineChatApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "チャットメッセージ",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "新しいメッセージと接続リクエストの通知"
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "chat_messages"
    }
}
