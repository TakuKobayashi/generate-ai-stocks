package com.offlinechat.data.models

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.offlinechat.data.database.ActiveRecord
import com.offlinechat.data.database.boolOr
import com.offlinechat.data.database.longOr
import com.offlinechat.data.database.strOrNull
import java.util.UUID

data class Message(
    var id: String = UUID.randomUUID().toString(),
    var chatRoomId: String = "",
    var senderId: String = "",
    var messageType: MessageType = MessageType.TEXT,
    var content: String? = null,
    var filePath: String? = null,
    var fileName: String? = null,
    var fileSize: Long? = null,
    var isSent: Boolean = false,
    var isDelivered: Boolean = false,
    var isRead: Boolean = false,
    var createdAt: Long = System.currentTimeMillis()
) : ActiveRecord<Message>() {

    override val tableName = "messages"
    override val primaryKey = "id"
    override fun getPrimaryKeyValue() = id

    override fun toContentValues() = ContentValues().apply {
        put("id", id); put("chat_room_id", chatRoomId); put("sender_id", senderId)
        put("message_type", messageType.name); put("content", content)
        put("file_path", filePath); put("file_name", fileName); put("file_size", fileSize)
        put("is_sent", if (isSent) 1 else 0); put("is_delivered", if (isDelivered) 1 else 0)
        put("is_read", if (isRead) 1 else 0); put("created_at", createdAt)
    }

    override fun fromCursor(cursor: Cursor) = Message(
        id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
        chatRoomId = cursor.getString(cursor.getColumnIndexOrThrow("chat_room_id")),
        senderId = cursor.getString(cursor.getColumnIndexOrThrow("sender_id")),
        messageType = runCatching { MessageType.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("message_type"))) }.getOrDefault(MessageType.TEXT),
        content = cursor.strOrNull("content"),
        filePath = cursor.strOrNull("file_path"),
        fileName = cursor.strOrNull("file_name"),
        fileSize = cursor.strOrNull("file_size")?.toLongOrNull(),
        isSent = cursor.boolOr("is_sent"),
        isDelivered = cursor.boolOr("is_delivered"),
        isRead = cursor.boolOr("is_read"),
        createdAt = cursor.longOr("created_at")
    ).also { it.setDatabase(db) }

    companion object {
        fun findByChatRoom(chatRoomId: String, db: SQLiteDatabase, limit: Int = 100): List<Message> =
            Message().also { it.setDatabase(db) }.findAll(
                selection = "chat_room_id = ?",
                selectionArgs = arrayOf(chatRoomId),
                orderBy = "created_at ASC LIMIT $limit"
            )

        fun markAsRead(chatRoomId: String, db: SQLiteDatabase) {
            db.execSQL("UPDATE messages SET is_read=1 WHERE chat_room_id='$chatRoomId' AND is_read=0")
        }
    }
}
