package com.example.nomikai

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.example.nomikai.data.db.NotificationRecord
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import com.example.nomikai.data.repository.UserRepository

@AndroidEntryPoint
class NomikaiFirebaseMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var userRepository: UserRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        const val CHANNEL_ID = "nomikai_channel"
        const val CHANNEL_NAME = "飲み会通知"
        const val EXTRA_INVITE_ID = "invite_id"
        const val EXTRA_NOTIFICATION_TYPE = "notification_type"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        serviceScope.launch {
            userRepository.updateFcmToken(token)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title    = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "飲みに誘われました！"
        val body     = remoteMessage.notification?.body  ?: remoteMessage.data["body"]  ?: ""
        val inviteId = remoteMessage.data["inviteId"]
        val type     = remoteMessage.data["type"] ?: "drinking_invite"

        // ① ローカルDBにActiveRecordで保存（通知一覧画面で表示される）
        serviceScope.launch {
            val userId = userRepository.getCurrentUserId() ?: return@launch
            NotificationRecord(
                id       = java.util.UUID.randomUUID().toString(),
                userId   = userId,
                inviteId = inviteId,
                title    = title,
                body     = body,
                dataJson = com.google.gson.Gson().toJson(remoteMessage.data)
            ).save()   // ← ActiveRecord#save()

            // 古い通知を整理
            NotificationRecord.pruneOld(userId, keepCount = 50)
        }

        // ② システム通知バーに表示
        showNotification(title, body, inviteId, type)
    }

    private fun showNotification(
        title: String,
        body: String,
        inviteId: String?,
        type: String
    ) {
        createNotificationChannel()

        // タップ時にアプリを開きNotification画面へ遷移
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_INVITE_ID, inviteId)
            putExtra(EXTRA_NOTIFICATION_TYPE, type)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_beer)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "飲み会の誘い通知"
                enableVibration(true)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
