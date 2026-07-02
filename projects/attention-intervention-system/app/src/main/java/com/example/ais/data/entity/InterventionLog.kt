package com.example.ais.data.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.Calendar

@Entity(
    tableName = "intervention_logs",
    indices = [Index(value = ["date_key"]), Index(value = ["trigger_type"])]
)
data class InterventionLog(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "triggered_at")
    val triggeredAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "trigger_type")
    val triggerType: TriggerType,

    @ColumnInfo(name = "date_key")
    val dateKey: String = Goal.todayKey()
) {
    fun isToday(): Boolean = dateKey == Goal.todayKey()

    companion object {
        // ── 頻度制御パラメータ ────────────────────────────
        /** SCREEN_ON 割り込み最小間隔: 15分 */
        private const val SCREEN_ON_MIN_INTERVAL_MS = 15 * 60 * 1000L
        /** SCREEN_ON 1日最大表示回数 */
        private const val SCREEN_ON_DAILY_MAX = 12
        /** 深夜開始時刻 (時) */
        private const val NIGHT_START_HOUR = 23
        /** 深夜終了時刻 (時) */
        private const val NIGHT_END_HOUR = 7

        fun screenOn() = InterventionLog(triggerType = TriggerType.SCREEN_ON)
        fun appLaunch() = InterventionLog(triggerType = TriggerType.APP_LAUNCH)
        fun notification() = InterventionLog(triggerType = TriggerType.NOTIFICATION)

        /**
         * SCREEN_ON 割り込み可否を判定する。
         *
         * 判定ルール:
         * 1. 深夜帯 (23:00〜07:00) は表示しない
         * 2. 1日の表示上限 (12回) を超えていたら表示しない
         * 3. 直前の SCREEN_ON 割り込みから15分未満なら表示しない
         */
        fun canInterveneNow(
            lastScreenOnLog: InterventionLog?,
            todayScreenOnCount: Int
        ): Boolean {
            // 深夜制限
            if (isNightTime()) return false

            // 1日の上限
            if (todayScreenOnCount >= SCREEN_ON_DAILY_MAX) return false

            // 初回は常にOK
            if (lastScreenOnLog == null) return true

            // 最小インターバル
            val elapsed = System.currentTimeMillis() - lastScreenOnLog.triggeredAt
            return elapsed >= SCREEN_ON_MIN_INTERVAL_MS
        }

        private fun isNightTime(): Boolean {
            val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
            return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
        }
    }
}

enum class TriggerType {
    SCREEN_ON,    // Hardモード: 画面ON時オーバーレイ
    APP_LAUNCH,   // Normal/Hardモード: アプリ起動時
    NOTIFICATION  // 通知送信ログ
}
