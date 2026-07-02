package com.example.ais.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.ais.notification.GoalNotificationManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class NotificationRefreshReceiver : BroadcastReceiver() {

    @Inject
    lateinit var notificationManager: GoalNotificationManager

    override fun onReceive(context: Context, intent: Intent) {
        val result = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                notificationManager.postGoalNotification()
                // 翌日分のAlarmを再スケジュール（チェーン方式）
                notificationManager.scheduleDailyRefresh()
            } finally {
                result.finish()
            }
        }
    }
}
