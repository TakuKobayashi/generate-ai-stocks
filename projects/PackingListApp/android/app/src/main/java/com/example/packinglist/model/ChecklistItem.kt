package com.example.packinglist.model

import androidx.room.*
import com.example.packinglist.data.AppDatabase
import kotlinx.coroutines.flow.Flow

@Entity(
    tableName = "checklist_items",
    foreignKeys = [
        ForeignKey(
            entity = Checklist::class,
            parentColumns = ["id"],
            childColumns = ["checklistId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Item::class,
            parentColumns = ["id"],
            childColumns = ["itemId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("checklistId"), Index("itemId")]
)
data class ChecklistItem(
    @PrimaryKey(autoGenerate = true)
    var id: Long = 0,
    var checklistId: Long,
    var itemId: Long,
    var isChecked: Boolean = false,
    var checkedAt: Long? = null
) {
    companion object {
        // チェックリストIDでチェックリストアイテムを取得
        fun findByChecklistId(checklistId: Long): Flow<List<ChecklistItem>> {
            return AppDatabase.getInstance().checklistItemDao().findByChecklistId(checklistId)
        }
        
        // チェックリストIDでチェックリストアイテムを詳細情報付きで取得
        fun findByChecklistIdWithDetails(checklistId: Long): Flow<List<ChecklistItemWithDetails>> {
            return AppDatabase.getInstance().checklistItemDao().findByChecklistIdWithDetails(checklistId)
        }
        
        // IDでチェックリストアイテムを取得
        suspend fun findById(id: Long): ChecklistItem? {
            return AppDatabase.getInstance().checklistItemDao().findById(id)
        }
        
        // チェックリストアイテムを作成
        suspend fun create(checklistId: Long, itemId: Long): ChecklistItem {
            val checklistItem = ChecklistItem(
                checklistId = checklistId,
                itemId = itemId,
                isChecked = false
            )
            checklistItem.save()
            return checklistItem
        }
        
        // 複数のチェックリストアイテムを一括挿入
        suspend fun insertAll(checklistItems: List<ChecklistItem>) {
            AppDatabase.getInstance().checklistItemDao().insertAll(checklistItems)
        }
    }
    
    // 保存（新規作成または更新）
    suspend fun save() {
        if (id == 0L) {
            id = AppDatabase.getInstance().checklistItemDao().insert(this)
        } else {
            AppDatabase.getInstance().checklistItemDao().update(this)
        }
    }
    
    // 削除
    suspend fun delete() {
        AppDatabase.getInstance().checklistItemDao().delete(this)
    }
    
    // チェック状態を切り替え
    suspend fun toggleCheck() {
        isChecked = !isChecked
        checkedAt = if (isChecked) System.currentTimeMillis() else null
        save()
    }
    
    // チェック状態を設定
    suspend fun setChecked(checked: Boolean) {
        isChecked = checked
        checkedAt = if (checked) System.currentTimeMillis() else null
        save()
    }
    
    // このチェックリストアイテムが属するチェックリストを取得
    suspend fun checklist(): Checklist? {
        return Checklist.findById(checklistId)
    }
    
    // このチェックリストアイテムが参照する持ち物を取得
    suspend fun item(): Item? {
        return Item.findById(itemId)
    }
}

// チェックリストアイテムの詳細情報
data class ChecklistItemWithDetails(
    val id: Long,
    val packingListId: Long,
    val name: String,
    val quantity: Int,
    val position: Int,
    val createdAt: Long,
    val isChecked: Boolean,
    val checklistItemId: Long
)

@Dao
interface ChecklistItemDao {
    @Query("SELECT * FROM checklist_items WHERE checklistId = :checklistId")
    fun findByChecklistId(checklistId: Long): Flow<List<ChecklistItem>>
    
    @Query("SELECT * FROM checklist_items WHERE id = :id")
    suspend fun findById(id: Long): ChecklistItem?
    
    @Query("""
        SELECT items.*, checklist_items.isChecked, checklist_items.id as checklistItemId
        FROM items
        INNER JOIN checklist_items ON items.id = checklist_items.itemId
        WHERE checklist_items.checklistId = :checklistId
        ORDER BY items.position ASC
    """)
    fun findByChecklistIdWithDetails(checklistId: Long): Flow<List<ChecklistItemWithDetails>>
    
    @Query("""
        SELECT items.*, checklist_items.isChecked, checklist_items.id as checklistItemId
        FROM items
        INNER JOIN checklist_items ON items.id = checklist_items.itemId
        WHERE checklist_items.checklistId = :checklistId
        ORDER BY items.position ASC
    """)
    suspend fun findByChecklistIdWithDetailsSync(checklistId: Long): List<ChecklistItemWithDetails>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(checklistItem: ChecklistItem): Long
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(checklistItems: List<ChecklistItem>)
    
    @Update
    suspend fun update(checklistItem: ChecklistItem)
    
    @Delete
    suspend fun delete(checklistItem: ChecklistItem)
}
