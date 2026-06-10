package com.example.clipboardmanager.repository

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.example.clipboardmanager.data.ClipboardDao
import com.example.clipboardmanager.data.ClipboardItem
import kotlinx.coroutines.flow.Flow

class ClipboardRepository(private val dao: ClipboardDao, private val context: Context) {
    private val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

    fun getAllItems(): Flow<List<ClipboardItem>> = dao.getAllItemsFlow()
    fun searchItems(query: String): Flow<List<ClipboardItem>> = dao.searchItemsFlow(query)
    suspend fun getFrequentlyUsed(minCount: Int = 2, limit: Int = 20) = dao.getFrequentlyUsed(minCount, limit)
    suspend fun insertOrUpdate(content: String) = dao.insertOrUpdate(content)
    suspend fun deleteItems(ids: List<Long>) = dao.deleteByIds(ids)

    suspend fun copyToClipboard(item: ClipboardItem) {
        cm.setPrimaryClip(ClipData.newPlainText("clipboard", item.content))
        dao.insertOrUpdate(item.content)
    }
}
