package com.example.ais.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.example.ais.data.prefs.getMode
import com.example.ais.domain.InterventionMode
import com.example.ais.notification.GoalNotificationManager
import com.example.ais.service.InterventionForegroundService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 端末再起動・アプリ更新後の復元。
 *
 * 役割:
 * 1. AlarmManager の再スケジュール（再起動でクリアされる）
 * 2. 通知の再送信
 * 3. Hard モードなら Foreground Service を再起動
 */
@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var notificationManager: GoalNotificationManager
    @Inject lateinit var prefs: DataStore<Preferences>

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        val result = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // 1. AlarmManager を再スケジュール
                notificationManager.scheduleDailyRefresh()

                // 2. 通知を再送信
                notificationManager.postGoalNotification()

                // 3. Hard モードなら Foreground Service を再起動
                val mode = prefs.getMode()
                if (mode == InterventionMode.HARD) {
                    InterventionForegroundService.start(context)
                }
            } finally {
                result.finish()
            }
        }
    }
}
