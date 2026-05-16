package com.example.nomikai.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

// ─────────────────────────────────────────────
//  Entity
// ─────────────────────────────────────────────
/**
 * ローカルユーザープロフィールのActiveRecordモデル。
 *
 * ```kotlin
 * // 作成・保存
 * UserRecord(id = uuid, name = "太郎", fcmToken = token).save()
 *
 * // 検索
 * val me = UserRecord.findCurrent()
 * val user = UserRecord.find(id)
 *
 * // FCMトークン更新
 * me?.updateFcmToken(newToken)
 *
 * // 削除
 * me?.delete()
 * ```
 */
@Entity(tableName = "users")
data class UserRecord(
    @PrimaryKey val id: String,
    val name: String,
    @ColumnInfo(name = "fcm_token") val fcmToken: String? = null,
    @ColumnInfo(name = "is_current") val isCurrent: Int = 0, // 1 = このデバイスのユーザー
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis()
) : ActiveRecord() {

    // ─── インスタンスメソッド ───────────────────────

    override suspend fun save(): Long =
        DatabaseHolder.db.userDao().upsert(this)

    override suspend fun delete(): Int =
        DatabaseHolder.db.userDao().delete(this)

    /** FCMトークンを更新して保存する */
    suspend fun updateFcmToken(token: String): UserRecord {
        val updated = copy(fcmToken = token, updatedAt = System.currentTimeMillis())
        updated.save()
        return updated
    }

    /** 名前を更新して保存する */
    suspend fun updateName(newName: String): UserRecord {
        val updated = copy(name = newName, updatedAt = System.currentTimeMillis())
        updated.save()
        return updated
    }

    // ─── クラスメソッド (companion) ────────────────

    companion object {
        private val dao get() = DatabaseHolder.db.userDao()

        /** IDでユーザーを検索する */
        suspend fun find(id: String): UserRecord? = dao.findById(id)

        /** 全ユーザーを取得する */
        suspend fun all(): List<UserRecord> = dao.findAll()

        /** このデバイスのカレントユーザーを取得する */
        suspend fun findCurrent(): UserRecord? = dao.findCurrent()

        /** カレントユーザーをFlowで監視する */
        fun observeCurrent(): Flow<UserRecord?> = dao.observeCurrent()

        /** カレントユーザーとして設定（既存のcurrentフラグをリセット） */
        suspend fun setCurrent(record: UserRecord) {
            dao.clearCurrentFlag()
            dao.upsert(record.copy(isCurrent = 1))
        }
    }
}

// ─────────────────────────────────────────────
//  DAO (非公開 - ActiveRecordの内部実装)
// ─────────────────────────────────────────────
@Dao
interface UserDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(user: UserRecord): Long

    @Delete
    suspend fun delete(user: UserRecord): Int

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): UserRecord?

    @Query("SELECT * FROM users")
    suspend fun findAll(): List<UserRecord>

    @Query("SELECT * FROM users WHERE is_current = 1 LIMIT 1")
    suspend fun findCurrent(): UserRecord?

    @Query("SELECT * FROM users WHERE is_current = 1 LIMIT 1")
    fun observeCurrent(): Flow<UserRecord?>

    @Query("UPDATE users SET is_current = 0")
    suspend fun clearCurrentFlag()
}
