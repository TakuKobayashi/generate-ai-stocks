package com.example.ais.data.dao

import androidx.room.*
import com.example.ais.data.entity.InterventionLog

@Dao
interface InterventionLogDao {

    @Insert
    suspend fun insert(log: InterventionLog): Long

    /** 最新ログ全種別 */
    @Query("SELECT * FROM intervention_logs ORDER BY triggered_at DESC LIMIT 1")
    suspend fun getLatest(): InterventionLog?

    /** SCREEN_ON のみ最新 */
    @Query("""
        SELECT * FROM intervention_logs
        WHERE trigger_type = 'SCREEN_ON'
        ORDER BY triggered_at DESC
        LIMIT 1
    """)
    suspend fun getLatestScreenOn(): InterventionLog?

    /** 今日の SCREEN_ON 回数 */
    @Query("""
        SELECT COUNT(*) FROM intervention_logs
        WHERE date_key = :dateKey AND trigger_type = 'SCREEN_ON'
    """)
    suspend fun countScreenOnByDate(dateKey: String): Int

    /** 今日の全種別カウント */
    @Query("SELECT COUNT(*) FROM intervention_logs WHERE date_key = :dateKey")
    suspend fun countByDate(dateKey: String): Int

    /** 30日以上前のログを削除（定期メンテ） */
    @Query("DELETE FROM intervention_logs WHERE triggered_at < :threshold")
    suspend fun deleteOlderThan(threshold: Long)
}
