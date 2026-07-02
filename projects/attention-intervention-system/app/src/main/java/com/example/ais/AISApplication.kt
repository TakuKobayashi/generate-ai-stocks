package com.example.ais

import android.app.Application
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.example.ais.data.prefs.getMode
import com.example.ais.domain.InterventionMode
import com.example.ais.notification.GoalNotificationManager
import com.example.ais.service.InterventionForegroundService
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class AISApplication : Application() {

    @Inject lateinit var notificationManager: GoalNotificationManager
    @Inject lateinit var prefs: DataStore<Preferences>

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()

        // 通知チャンネルを最初に作成
        notificationManager.createChannel()

        // Hard モードなら Foreground Service を開始
        appScope.launch {
            val mode = prefs.getMode()
            if (mode == InterventionMode.HARD) {
                InterventionForegroundService.start(this@AISApplication)
            }
        }
    }

    /**
     * モード変更時に呼び出す。
     * HARD → Service 起動
     * それ以外 → Service 停止
     */
    fun updateInterventionService(mode: InterventionMode) {
        when (mode) {
            InterventionMode.HARD -> InterventionForegroundService.start(this)
            else -> InterventionForegroundService.stop(this)
        }
    }
}
