package com.example.clipboardmanager.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import java.util.Date

@Dao
interface ClipboardDao {

    @Query("SELECT * FROM clipboard_items ORDER BY last_used_at DESC")
    fun getAllItemsFlow(): Flow<List<ClipboardItem>>

    @Query("SELECT * FROM clipboard_items ORDER BY last_used_at DESC")
    suspend fun getAllItems(): List<ClipboardItem>

    @Query("SELECT * FROM clipboard_items WHERE content LIKE '%' || :query || '%' ORDER BY last_used_at DESC")
    fun searchItemsFlow(query: String): Flow<List<ClipboardItem>>

    @Query("SELECT * FROM clipboard_items WHERE content = :content LIMIT 1")
    suspend fun findByContent(content: String): ClipboardItem?

    @Query("SELECT * FROM clipboard_items WHERE usage_count >= :minCount ORDER BY usage_count DESC, last_used_at DESC LIMIT :limit")
    suspend fun getFrequentlyUsed(minCount: Int = 2, limit: Int = 20): List<ClipboardItem>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(item: ClipboardItem): Long

    @Update
    suspend fun update(item: ClipboardItem)

    @Query("DELETE FROM clipboard_items WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Transaction
    suspend fun insertOrUpdate(content: String): ClipboardItem {
        val existing = findByContent(content)
        return if (existing != null) {
            val updated = existing.copy(lastUsedAt = Date(), usageCount = existing.usageCount + 1)
            update(updated)
            updated
        } else {
            val now = Date()
            val newItem = ClipboardItem(content = content, createdAt = now, lastUsedAt = now)
            val id = insert(newItem)
            newItem.copy(id = id)
        }
    }
}
