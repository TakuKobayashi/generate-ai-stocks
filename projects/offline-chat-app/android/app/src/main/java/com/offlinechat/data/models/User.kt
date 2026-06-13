package com.offlinechat.data.models

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.offlinechat.data.database.ActiveRecord
import com.offlinechat.data.database.boolOr
import com.offlinechat.data.database.longOr
import com.offlinechat.data.database.strOrNull
import java.util.UUID

data class User(
    var id: String = UUID.randomUUID().toString(),
    var displayName: String = "",
    var bio: String? = null,
    var iconPath: String? = null,
    var isDiscoverable: Boolean = true,
    var createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = System.currentTimeMillis()
) : ActiveRecord<User>() {

    override val tableName = "users"
    override val primaryKey = "id"
    override fun getPrimaryKeyValue() = id

    override fun toContentValues() = ContentValues().apply {
        updatedAt = System.currentTimeMillis()
        put("id", id); put("display_name", displayName); put("bio", bio)
        put("icon_path", iconPath); put("is_discoverable", if (isDiscoverable) 1 else 0)
        put("created_at", createdAt); put("updated_at", updatedAt)
    }

    override fun fromCursor(cursor: Cursor) = User(
        id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
        displayName = cursor.getString(cursor.getColumnIndexOrThrow("display_name")),
        bio = cursor.strOrNull("bio"),
        iconPath = cursor.strOrNull("icon_path"),
        isDiscoverable = cursor.boolOr("is_discoverable", true),
        createdAt = cursor.longOr("created_at"),
        updatedAt = cursor.longOr("updated_at")
    ).also { it.setDatabase(db) }

    companion object {
        fun find(id: String, db: SQLiteDatabase) = User().also { it.setDatabase(db) }.findById(id)
        fun all(db: SQLiteDatabase) = User().also { it.setDatabase(db) }.findAll()
        fun firstOrNull(db: SQLiteDatabase) = all(db).firstOrNull()
    }
}
