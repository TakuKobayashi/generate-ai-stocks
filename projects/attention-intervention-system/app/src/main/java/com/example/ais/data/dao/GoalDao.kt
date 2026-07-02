package com.example.ais.data.dao

import androidx.room.*
import com.example.ais.data.entity.Goal
import kotlinx.coroutines.flow.Flow

@Dao
interface GoalDao {

    // ── 取得 ─────────────────────────────────────────────

    @Query("SELECT * FROM goals WHERE is_active = 1 ORDER BY display_order ASC")
    fun observeActiveGoals(): Flow<List<Goal>>

    @Query("SELECT * FROM goals WHERE is_active = 1 ORDER BY display_order ASC")
    suspend fun getActiveGoals(): List<Goal>

    @Query("SELECT * FROM goals WHERE date_key = :dateKey AND is_active = 1 ORDER BY display_order ASC")
    suspend fun getGoalsByDate(dateKey: String): List<Goal>

    // ── 更新 ─────────────────────────────────────────────

    @Upsert
    suspend fun upsert(goal: Goal): Long

    @Upsert
    suspend fun upsertAll(goals: List<Goal>)

    @Update
    suspend fun update(goal: Goal)

    @Query("UPDATE goals SET is_active = 0 WHERE date_key = :dateKey")
    suspend fun deactivateByDate(dateKey: String)

    // ── 削除 ─────────────────────────────────────────────

    @Delete
    suspend fun delete(goal: Goal)

    @Query("DELETE FROM goals WHERE date_key < :dateKey AND is_active = 0")
    suspend fun deleteOldInactive(dateKey: String)
}
