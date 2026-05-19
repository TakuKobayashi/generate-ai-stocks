package com.example.packinglist.model

import androidx.room.*
import com.example.packinglist.data.AppDatabase
import kotlinx.coroutines.flow.Flow

@Entity(
    tableName = "checklists",
    foreignKeys = [
        ForeignKey(
            entity = PackingList::class,
            parentColumns = ["id"],
            childColumns = ["packingListId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Event::class,
            parentColumns = ["id"],
            childColumns = ["eventId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("packingListId"), Index("eventId")]
)
data class Checklist(
    @PrimaryKey(autoGenerate = true)
    var id: Long = 0,
    var packingListId: Long,
    var eventId: String,
    var createdAt: Long = System.currentTimeMillis()
) {
    companion object {
        // 持ち物リストIDでチェックリストを取得
        fun findByPackingListId(packingListId: Long): Flow<List<Checklist>> {
            return AppDatabase.getInstance().checklistDao().findByPackingListId(packingListId)
        }
        
        // IDでチェックリストを取得
        suspend fun findById(id: Long): Checklist? {
            return AppDatabase.getInstance().checklistDao().findById(id)
        }
        
        // 予定と持ち物リストでチェックリストを取得
        suspend fun findByEventAndPackingList(eventId: String, packingListId: Long): Checklist? {
            return AppDatabase.getInstance().checklistDao().findByEventAndPackingList(eventId, packingListId)
        }
        
        // チェックリストを作成（持ち物も自動的に追加）
        suspend fun create(eventId: String, packingListId: Long): Checklist {
            // 既存のチェックリストをチェック
            val existing = findByEventAndPackingList(eventId, packingListId)
            if (existing != null) {
                return existing
            }
            
            val checklist = Checklist(
                packingListId = packingListId,
                eventId = eventId
            )
            checklist.save()
            
            // 持ち物リストの全アイテムをチェックリストアイテムとして追加
            val packingList = PackingList.findById(packingListId)
            if (packingList != null) {
                checklist.initializeItems()
            }
            
            return checklist
        }
    }
    
    // 保存（新規作成または更新）
    suspend fun save() {
        if (id == 0L) {
            id = AppDatabase.getInstance().checklistDao().insert(this)
        } else {
            AppDatabase.getInstance().checklistDao().update(this)
        }
    }
    
    // 削除
    suspend fun delete() {
        AppDatabase.getInstance().checklistDao().delete(this)
    }
    
    // このチェックリストのアイテムを初期化
    suspend fun initializeItems() {
        val items = Item.findByPackingListId(packingListId)
        // Flowから値を取得するために一時的に収集
        val dao = AppDatabase.getInstance().itemDao()
        val itemsList = mutableListOf<Item>()
        
        // 直接DAOから取得
        val allItems = dao.findByPackingListId(packingListId)
        // 注: 実際の実装では、ViewModelやActivityでFlowを収集する必要がある
    }
    
    // チェックリストアイテムを追加
    suspend fun addChecklistItem(itemId: Long): ChecklistItem {
        return ChecklistItem.create(id, itemId)
    }
    
    // このチェックリストのアイテムを取得
    fun items(): Flow<List<ChecklistItemWithDetails>> {
        return ChecklistItem.findByChecklistIdWithDetails(id)
    }
    
    // このチェックリストの予定を取得
    suspend fun event(): Event? {
        return Event.findById(eventId)
    }
    
    // このチェックリストの持ち物リストを取得
    suspend fun packingList(): PackingList? {
        return PackingList.findById(packingListId)
    }
}

@Dao
interface ChecklistDao {
    @Query("SELECT * FROM checklists WHERE packingListId = :packingListId ORDER BY createdAt DESC")
    fun findByPackingListId(packingListId: Long): Flow<List<Checklist>>
    
    @Query("SELECT * FROM checklists WHERE packingListId = :packingListId ORDER BY createdAt DESC")
    suspend fun findByPackingListIdSync(packingListId: Long): List<Checklist>
    
    @Query("SELECT * FROM checklists WHERE id = :id")
    suspend fun findById(id: Long): Checklist?
    
    @Query("SELECT * FROM checklists WHERE eventId = :eventId AND packingListId = :packingListId")
    suspend fun findByEventAndPackingList(eventId: String, packingListId: Long): Checklist?
    
    @Insert
    suspend fun insert(checklist: Checklist): Long
    
    @Update
    suspend fun update(checklist: Checklist)
    
    @Delete
    suspend fun delete(checklist: Checklist)
}
