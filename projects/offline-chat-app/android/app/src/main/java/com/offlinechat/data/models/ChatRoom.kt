package com.offlinechat.data.models

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.offlinechat.data.database.ActiveRecord
import com.offlinechat.data.database.boolOr
import com.offlinechat.data.database.intOr
import com.offlinechat.data.database.longOr
import com.offlinechat.data.database.strOrNull
import java.util.UUID

data class ChatRoom(
    var id: String = UUID.randomUUID().toString(),
    var peerUserId: String = "",
    var lastMessage: String? = null,
    var lastMessageTime: Long? = null,
    var unreadCount: Int = 0,
    var isRequestPending: Boolean = false,
    var isRequestAccepted: Boolean = false,
    var createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = System.currentTimeMillis()
) : ActiveRecord<ChatRoom>() {

    override val tableName = "chat_rooms"
    override val primaryKey = "id"
    override fun getPrimaryKeyValue() = id

    override fun toContentValues() = ContentValues().apply {
        updatedAt = System.currentTimeMillis()
        put("id", id); put("peer_user_id", peerUserId); put("last_message", lastMessage)
        put("last_message_time", lastMessageTime); put("unread_count", unreadCount)
        put("is_request_pending", if (isRequestPending) 1 else 0)
        put("is_request_accepted", if (isRequestAccepted) 1 else 0)
        put("created_at", createdAt); put("updated_at", updatedAt)
    }

    override fun fromCursor(cursor: Cursor) = ChatRoom(
        id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
        peerUserId = cursor.getString(cursor.getColumnIndexOrThrow("peer_user_id")),
        lastMessage = cursor.strOrNull("last_message"),
        lastMessageTime = cursor.strOrNull("last_message_time")?.toLongOrNull(),
        unreadCount = cursor.intOr("unread_count"),
        isRequestPending = cursor.boolOr("is_request_pending"),
        isRequestAccepted = cursor.boolOr("is_request_accepted"),
        createdAt = cursor.longOr("created_at"),
        updatedAt = cursor.longOr("updated_at")
    ).also { it.setDatabase(db) }

    companion object {
        fun find(id: String, db: SQLiteDatabase) = ChatRoom().also { it.setDatabase(db) }.findById(id)

        fun findByPeerUserId(peerId: String, db: SQLiteDatabase) =
            ChatRoom().also { it.setDatabase(db) }.findOne("peer_user_id = ?", arrayOf(peerId))

        fun allSortedWithNearby(nearbyIds: List<String>, db: SQLiteDatabase): List<ChatRoom> {
            val r = ChatRoom().also { it.setDatabase(db) }
            return if (nearbyIds.isEmpty()) {
                r.findAll(orderBy = "COALESCE(last_message_time,0) DESC")
            } else {
                val ids = nearbyIds.joinToString(",") { "'${it.replace("'", "''")}'" }
                r.rawQuery(
                    "SELECT * FROM chat_rooms ORDER BY CASE WHEN peer_user_id IN ($ids) THEN 0 ELSE 1 END, COALESCE(last_message_time,0) DESC"
                )
            }
        }
    }
}
