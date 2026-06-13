package com.offlinechat.data.models

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.offlinechat.data.database.ActiveRecord
import com.offlinechat.data.database.longOr
import com.offlinechat.data.database.strOrNull

data class NearbyPeer(
    var endpointId: String = "",
    var userId: String = "",
    var displayName: String = "",
    var iconPath: String? = null,
    var bio: String? = null,
    var lastSeen: Long = System.currentTimeMillis()
) : ActiveRecord<NearbyPeer>() {

    override val tableName = "nearby_peers"
    override val primaryKey = "endpoint_id"
    override fun getPrimaryKeyValue() = endpointId

    override fun toContentValues() = ContentValues().apply {
        put("endpoint_id", endpointId); put("user_id", userId); put("display_name", displayName)
        put("icon_path", iconPath); put("bio", bio); put("last_seen", lastSeen)
    }

    override fun fromCursor(cursor: Cursor) = NearbyPeer(
        endpointId = cursor.getString(cursor.getColumnIndexOrThrow("endpoint_id")),
        userId = cursor.getString(cursor.getColumnIndexOrThrow("user_id")),
        displayName = cursor.getString(cursor.getColumnIndexOrThrow("display_name")),
        iconPath = cursor.strOrNull("icon_path"),
        bio = cursor.strOrNull("bio"),
        lastSeen = cursor.longOr("last_seen")
    ).also { it.setDatabase(db) }

    companion object {
        fun all(db: SQLiteDatabase) = NearbyPeer().also { it.setDatabase(db) }.findAll(orderBy = "display_name ASC")
        fun cleanup(db: SQLiteDatabase, olderThan: Long) {
            db.delete("nearby_peers", "last_seen < ?", arrayOf(olderThan.toString()))
        }
    }
}
