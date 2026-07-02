package com.example.ais.notification

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.example.ais.MainActivity
import com.example.ais.R
import com.example.ais.data.dao.GoalDao
import com.example.ais.data.dao.InterventionLogDao
import com.example.ais.data.entity.Goal
import com.example.ais.data.entity.InterventionLog
import com.example.ais.data.prefs.setNotificationPostedDate
import com.example.ais.receiver.NotificationRefreshReceiver
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Calendar
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GoalNotificationManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val goalDao: GoalDao,
    private val logDao: InterventionLogDao,
    private val prefs: DataStore<Preferences>
) {
    companion object {
        const val CHANNEL_ID = "ais_goals"
        const val NOTIFICATION_ID = 1001
    }

    fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "今日の目標",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "目標を視界に表示します"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        context.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    suspend fun postGoalNotification() {
        val goals = goalDao.getActiveGoals().filter { it.text.isNotBlank() }
        if (goals.isEmpty()) return

        val contentText = goals.joinToString("  /  ") { it.text }

        val tapIntent = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_goal)
            .setContentTitle("今日の目標")
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false)
            .setAutoCancel(false)
            .setLocalOnly(true)
            .setContentIntent(tapIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            logDao.insert(InterventionLog.notification())
            prefs.setNotificationPostedDate(Goal.todayKey())
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS 権限なし - サイレントスキップ
        }
    }

    /**
     * 毎朝6時に通知を更新するAlarmをスケジュール。
     *
     * Android 12+: SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM 権限が必要。
     *   - USE_EXACT_ALARM (API 33+): Manifest宣言のみで使用可能（バッテリー最適化対象外）
     *   - SCHEDULE_EXACT_ALARM (API 31+): ユーザーが設定から許可が必要
     * 権限なし時は setInexactRepeating にフォールバックする。
     */
    fun scheduleDailyRefresh() {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val intent = PendingIntent.getBroadcast(
            context, 0,
            Intent(context, NotificationRefreshReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 6)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DATE, 1)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    calendar.timeInMillis,
                    intent
                )
            } else {
                // 権限なし or API 30以下: 不正確なアラームで代替
                am.setInexactRepeating(
                    AlarmManager.RTC_WAKEUP,
                    calendar.timeInMillis,
                    AlarmManager.INTERVAL_DAY,
                    intent
                )
            }
        } catch (e: SecurityException) {
            am.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                intent
            )
        }
    }
}
