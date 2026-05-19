package com.example.packinglist.model

import androidx.room.*
import com.example.packinglist.data.AppDatabase
import kotlinx.coroutines.flow.Flow

@Entity(
    tableName = "items",
    foreignKeys = [
        ForeignKey(
            entity = PackingList::class,
            parentColumns = ["id"],
            childColumns = ["packingListId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("packingListId")]
)
data class Item(
    @PrimaryKey(autoGenerate = true)
    var id: Long = 0,
    var packingListId: Long,
    var name: String,
    var quantity: Int = 1,
    var position: Int = 0,
    var createdAt: Long = System.currentTimeMillis()
) {
    companion object {
        // 持ち物リストIDで持ち物を取得
        fun findByPackingListId(packingListId: Long): Flow<List<Item>> {
            return AppDatabase.getInstance().itemDao().findByPackingListId(packingListId)
        }
        
        // IDで持ち物を取得
        suspend fun findById(id: Long): Item? {
            return AppDatabase.getInstance().itemDao().findById(id)
        }
        
        // 持ち物を作成
        suspend fun create(packingListId: Long, name: String, quantity: Int = 1): Item {
            val dao = AppDatabase.getInstance().itemDao()
            val maxPosition = dao.getMaxPosition(packingListId) ?: -1
            
            val item = Item(
                packingListId = packingListId,
                name = name,
                quantity = quantity,
                position = maxPosition + 1
            )
            item.save()
            return item
        }
        
        // 複数の持ち物を一括更新
        suspend fun updateAll(items: List<Item>) {
            AppDatabase.getInstance().itemDao().updateAll(items)
        }
    }
    
    // 保存（新規作成または更新）
    suspend fun save() {
        if (id == 0L) {
            id = AppDatabase.getInstance().itemDao().insert(this)
        } else {
            AppDatabase.getInstance().itemDao().update(this)
        }
    }
    
    // 削除
    suspend fun delete() {
        AppDatabase.getInstance().itemDao().delete(this)
    }
    
    // この持ち物が属する持ち物リストを取得
    suspend fun packingList(): PackingList? {
        return PackingList.findById(packingListId)
    }
}

@Dao
interface ItemDao {
    @Query("SELECT * FROM items WHERE packingListId = :packingListId ORDER BY position ASC")
    fun findByPackingListId(packingListId: Long): Flow<List<Item>>
    
    @Query("SELECT * FROM items WHERE packingListId = :packingListId ORDER BY position ASC")
    suspend fun findByPackingListIdSync(packingListId: Long): List<Item>
    
    @Query("SELECT * FROM items WHERE id = :id")
    suspend fun findById(id: Long): Item?
    
    @Insert
    suspend fun insert(item: Item): Long
    
    @Update
    suspend fun update(item: Item)
    
    @Update
    suspend fun updateAll(items: List<Item>)
    
    @Delete
    suspend fun delete(item: Item)
    
    @Query("SELECT MAX(position) FROM items WHERE packingListId = :packingListId")
    suspend fun getMaxPosition(packingListId: Long): Int?
}
