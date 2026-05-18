package com.example.nomikai.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

// ─────────────────────────────────────────────
//  Entity
// ─────────────────────────────────────────────
/**
 * 受信プッシュ通知のキャッシュActiveRecordモデル。
 * FCM受信時にローカルDBへ保存し、通知一覧画面はDBから読み込む。
 *
 * ```kotlin
 * // FCM受信時に保存
 * NotificationRecord(
 *     id        = uuid,
 *     userId    = currentUserId,
 *     inviteId  = data["inviteId"],
 *     title     = remoteMessage.notification?.title ?: "",
 *     body      = remoteMessage.notification?.body ?: "",
 *     dataJson  = gson.toJson(data)
 * ).save()
 *
 * // 一覧取得
 * val all    = NotificationRecord.allForUser(userId)
 * val unread = NotificationRecord.unreadForUser(userId)
 * val count  = NotificationRecord.unreadCount(userId)
 *
 * // 既読
 * notification.markRead()
 *
 * // 全件既読
 * NotificationRecord.markAllRead(userId)
 * ```
 */
@Entity(
    tableName = "notifications",
    indices = [
        Index(value = ["user_id", "created_at"]),
        Index(value = ["user_id", "is_read"])
    ]
)
data class NotificationRecord(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "user_id") val userId: String,
    @ColumnInfo(name = "invite_id") val inviteId: String? = null,
    val title: String,
    val body: String,
    @ColumnInfo(name = "data_json") val dataJson: String? = null,
    @ColumnInfo(name = "is_read") val isRead: Int = 0,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
) : ActiveRecord() {

    // ─── 算出プロパティ ────────────────────────────

    val isUnread: Boolean get() = isRead == 0

    // ─── インスタンスメソッド ───────────────────────

    override suspend fun save(): Long =
        DatabaseHolder.db.notificationDao().upsert(this)

    override suspend fun delete(): Int =
        DatabaseHolder.db.notificationDao().delete(this)

    /**
     * この通知を既読にする。
     * @return 既読状態になった新しいインスタンス
     */
    suspend fun markRead(): NotificationRecord {
        val updated = copy(isRead = 1)
        DatabaseHolder.db.notificationDao().markRead(id)
        return updated
    }

    // ─── クラスメソッド (companion) ────────────────

    companion object {
        private val dao get() = DatabaseHolder.db.notificationDao()

        /** ユーザーの全通知を新しい順で取得する */
        suspend fun allForUser(userId: String): List<NotificationRecord> =
            dao.findAllByUser(userId)

        /** ユーザーの未読通知のみ取得する */
        suspend fun unreadForUser(userId: String): List<NotificationRecord> =
            dao.findUnreadByUser(userId)

        /** 未読件数を取得する */
        suspend fun unreadCount(userId: String): Int =
            dao.countUnread(userId)

        /** ユーザーの通知をFlowで監視する */
        fun observeForUser(userId: String): Flow<List<NotificationRecord>> =
            dao.observeByUser(userId)

        /** 未読件数をFlowで監視する */
        fun observeUnreadCount(userId: String): Flow<Int> =
            dao.observeUnreadCount(userId)

        /** ユーザーの全通知を既読にする */
        suspend fun markAllRead(userId: String) =
            dao.markAllRead(userId)

        /** 30件を超えた古い通知を削除する（ストレージ節約） */
        suspend fun pruneOld(userId: String, keepCount: Int = 50) =
            dao.deleteOldExceeding(userId, keepCount)
    }
}

// ─────────────────────────────────────────────
//  DAO (非公開 - ActiveRecordの内部実装)
// ─────────────────────────────────────────────
@Dao
interface NotificationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(record: NotificationRecord): Long

    @Delete
    suspend fun delete(record: NotificationRecord): Int

    @Query("SELECT * FROM notifications WHERE user_id = :userId ORDER BY created_at DESC")
    suspend fun findAllByUser(userId: String): List<NotificationRecord>

    @Query("SELECT * FROM notifications WHERE user_id = :userId AND is_read = 0 ORDER BY created_at DESC")
    suspend fun findUnreadByUser(userId: String): List<NotificationRecord>

    @Query("SELECT COUNT(*) FROM notifications WHERE user_id = :userId AND is_read = 0")
    suspend fun countUnread(userId: String): Int

    @Query("SELECT * FROM notifications WHERE user_id = :userId ORDER BY created_at DESC")
    fun observeByUser(userId: String): Flow<List<NotificationRecord>>

    @Query("SELECT COUNT(*) FROM notifications WHERE user_id = :userId AND is_read = 0")
    fun observeUnreadCount(userId: String): Flow<Int>

    @Query("UPDATE notifications SET is_read = 1 WHERE id = :id")
    suspend fun markRead(id: String)

    @Query("UPDATE notifications SET is_read = 1 WHERE user_id = :userId AND is_read = 0")
    suspend fun markAllRead(userId: String)

    /**
     * 新しい順で keepCount 件を残し、古いレコードを削除する。
     * サブクエリでrowid上位N件のIDを特定し、それ以外を削除。
     */
    @Query("""
        DELETE FROM notifications 
        WHERE user_id = :userId 
        AND id NOT IN (
            SELECT id FROM notifications 
            WHERE user_id = :userId 
            ORDER BY created_at DESC 
            LIMIT :keepCount
        )
    """)
    suspend fun deleteOldExceeding(userId: String, keepCount: Int)
}
