package com.example.nomikai.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

// ─────────────────────────────────────────────
//  Entity
// ─────────────────────────────────────────────
/**
 * 飲み会誘いのキャッシュActiveRecordモデル。
 * サーバーから取得した誘いをローカルにキャッシュし、オフライン閲覧も可能にする。
 *
 * ```kotlin
 * // APIレスポンスからキャッシュ保存
 * DrinkingInviteRecord.fromApiResponse(invite).save()
 *
 * // 検索
 * val received = DrinkingInviteRecord.receivedBy(userId)
 * val sent     = DrinkingInviteRecord.sentBy(userId)
 * val invite   = DrinkingInviteRecord.find(inviteId)
 *
 * // ステータス変更
 * invite?.close()
 * invite?.cancel()
 *
 * // 削除
 * invite?.delete()
 * ```
 */
@Entity(
    tableName = "drinking_invites",
    indices = [
        Index(value = ["creator_id"]),
        Index(value = ["direction", "user_id", "date_time"])
    ]
)
data class DrinkingInviteRecord(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "creator_id") val creatorId: String,
    @ColumnInfo(name = "creator_name") val creatorName: String,
    /** "sent" = 自分が送った / "received" = 受け取った */
    val direction: String,
    /** この端末のuserId (検索・フィルタ用) */
    @ColumnInfo(name = "user_id") val userId: String,
    @ColumnInfo(name = "date_time") val dateTime: Long,
    @ColumnInfo(name = "location_lat") val locationLat: Double? = null,
    @ColumnInfo(name = "location_lng") val locationLng: Double? = null,
    @ColumnInfo(name = "location_name") val locationName: String? = null,
    @ColumnInfo(name = "participant_count") val participantCount: Int = 2,
    val message: String? = null,
    /** "open" | "closed" | "cancelled" */
    val status: String = STATUS_OPEN,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "synced_at") val syncedAt: Long = System.currentTimeMillis()
) : ActiveRecord() {

    // ─── 算出プロパティ ────────────────────────────

    val isOpen: Boolean get() = status == STATUS_OPEN
    val isClosed: Boolean get() = status == STATUS_CLOSED
    val isCancelled: Boolean get() = status == STATUS_CANCELLED
    val isSent: Boolean get() = direction == DIRECTION_SENT
    val isReceived: Boolean get() = direction == DIRECTION_RECEIVED

    // ─── インスタンスメソッド ───────────────────────

    override suspend fun save(): Long =
        DatabaseHolder.db.drinkingInviteDao().upsert(this)

    override suspend fun delete(): Int =
        DatabaseHolder.db.drinkingInviteDao().delete(this)

    /** 募集を締め切る */
    suspend fun close(): DrinkingInviteRecord {
        val updated = copy(status = STATUS_CLOSED)
        DatabaseHolder.db.drinkingInviteDao().updateStatus(id, STATUS_CLOSED)
        return updated
    }

    /** 募集をキャンセルする */
    suspend fun cancel(): DrinkingInviteRecord {
        val updated = copy(status = STATUS_CANCELLED)
        DatabaseHolder.db.drinkingInviteDao().updateStatus(id, STATUS_CANCELLED)
        return updated
    }

    /** 同期日時を更新する */
    suspend fun touch(): DrinkingInviteRecord {
        val updated = copy(syncedAt = System.currentTimeMillis())
        updated.save()
        return updated
    }

    // ─── クラスメソッド (companion) ────────────────

    companion object {
        const val STATUS_OPEN = "open"
        const val STATUS_CLOSED = "closed"
        const val STATUS_CANCELLED = "cancelled"
        const val DIRECTION_SENT = "sent"
        const val DIRECTION_RECEIVED = "received"

        private val dao get() = DatabaseHolder.db.drinkingInviteDao()

        /** IDで誘いを検索する */
        suspend fun find(id: String): DrinkingInviteRecord? = dao.findById(id)

        /** ユーザーが受け取った誘い一覧（新しい順） */
        suspend fun receivedBy(userId: String): List<DrinkingInviteRecord> =
            dao.findReceived(userId)

        /** ユーザーが送った誘い一覧（新しい順） */
        suspend fun sentBy(userId: String): List<DrinkingInviteRecord> =
            dao.findSent(userId)

        /** 受け取った誘いをFlowで監視する */
        fun observeReceived(userId: String): Flow<List<DrinkingInviteRecord>> =
            dao.observeReceived(userId)

        /** 送った誘いをFlowで監視する */
        fun observeSent(userId: String): Flow<List<DrinkingInviteRecord>> =
            dao.observeSent(userId)

        /** ステータスでフィルタして取得する */
        suspend fun whereStatus(userId: String, status: String): List<DrinkingInviteRecord> =
            dao.findByStatus(userId, status)

        /** 古いキャッシュを削除する（日時でフィルタ） */
        suspend fun deleteOlderThan(thresholdMs: Long) =
            dao.deleteOlderThan(thresholdMs)

        /**
         * APIレスポンスから DrinkingInviteRecord を生成するファクトリ。
         *
         * @param apiInvite  APIから取得した誘いデータ
         * @param currentUserId  このデバイスのユーザーID
         */
        fun fromApiResponse(
            apiInvite: com.example.nomikai.data.api.models.DrinkingInvite,
            currentUserId: String
        ): DrinkingInviteRecord {
            val direction = if (apiInvite.creatorId == currentUserId)
                DIRECTION_SENT else DIRECTION_RECEIVED
            return DrinkingInviteRecord(
                id              = apiInvite.id,
                creatorId       = apiInvite.creatorId,
                creatorName     = apiInvite.creatorName,
                direction       = direction,
                userId          = currentUserId,
                dateTime        = apiInvite.dateTime,
                locationLat     = apiInvite.locationLat,
                locationLng     = apiInvite.locationLng,
                locationName    = apiInvite.locationName,
                participantCount = apiInvite.participantCount,
                message         = apiInvite.message,
                status          = apiInvite.status,
                createdAt       = apiInvite.createdAt,
                syncedAt        = System.currentTimeMillis()
            )
        }
    }
}

// ─────────────────────────────────────────────
//  DAO (非公開 - ActiveRecordの内部実装)
// ─────────────────────────────────────────────
@Dao
interface DrinkingInviteDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(record: DrinkingInviteRecord): Long

    @Delete
    suspend fun delete(record: DrinkingInviteRecord): Int

    @Query("SELECT * FROM drinking_invites WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): DrinkingInviteRecord?

    @Query("""
        SELECT * FROM drinking_invites 
        WHERE user_id = :userId AND direction = 'received' 
        ORDER BY created_at DESC
    """)
    suspend fun findReceived(userId: String): List<DrinkingInviteRecord>

    @Query("""
        SELECT * FROM drinking_invites 
        WHERE user_id = :userId AND direction = 'sent' 
        ORDER BY created_at DESC
    """)
    suspend fun findSent(userId: String): List<DrinkingInviteRecord>

    @Query("""
        SELECT * FROM drinking_invites 
        WHERE user_id = :userId AND direction = 'received' 
        ORDER BY created_at DESC
    """)
    fun observeReceived(userId: String): Flow<List<DrinkingInviteRecord>>

    @Query("""
        SELECT * FROM drinking_invites 
        WHERE user_id = :userId AND direction = 'sent' 
        ORDER BY created_at DESC
    """)
    fun observeSent(userId: String): Flow<List<DrinkingInviteRecord>>

    @Query("""
        SELECT * FROM drinking_invites 
        WHERE user_id = :userId AND status = :status 
        ORDER BY date_time ASC
    """)
    suspend fun findByStatus(userId: String, status: String): List<DrinkingInviteRecord>

    @Query("UPDATE drinking_invites SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: String)

    @Query("DELETE FROM drinking_invites WHERE created_at < :thresholdMs")
    suspend fun deleteOlderThan(thresholdMs: Long)
}
