package com.example.clipboardmanager.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Date

@Entity(tableName = "clipboard_items")
data class ClipboardItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "content") val content: String,
    @ColumnInfo(name = "created_at") val createdAt: Date,
    @ColumnInfo(name = "last_used_at") val lastUsedAt: Date,
    @ColumnInfo(name = "usage_count") val usageCount: Int = 1
) {
    fun getPreviewText(maxLength: Int = 100): String =
        if (content.length > maxLength) content.substring(0, maxLength) + "..." else content
}
