package com.example.packinglist.model

import androidx.room.*
import com.example.packinglist.data.AppDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "packing_lists")
data class PackingList(
    @PrimaryKey(autoGenerate = true)
    var id: Long = 0,
    var name: String,
    var description: String = "",
    var createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = System.currentTimeMillis()
) {
    companion object {
        // 全ての持ち物リストを取得
        fun findAll(): Flow<List<PackingList>> {
            return AppDatabase.getInstance().packingListDao().findAll()
        }
        
        // IDで持ち物リストを取得
        suspend fun findById(id: Long): PackingList? {
            return AppDatabase.getInstance().packingListDao().findById(id)
        }
        
        // 持ち物リストを作成
        suspend fun create(name: String, description: String = ""): PackingList {
            val packingList = PackingList(
                name = name,
                description = description
            )
            packingList.save()
            return packingList
        }
    }
    
    // 保存（新規作成または更新）
    suspend fun save() {
        updatedAt = System.currentTimeMillis()
        if (id == 0L) {
            id = AppDatabase.getInstance().packingListDao().insert(this)
        } else {
            AppDatabase.getInstance().packingListDao().update(this)
        }
    }
    
    // 削除
    suspend fun delete() {
        AppDatabase.getInstance().packingListDao().delete(this)
    }
    
    // このリストに属する持ち物を取得
    fun items(): Flow<List<Item>> {
        return Item.findByPackingListId(id)
    }
    
    // このリストのチェックリストを取得
    fun checklists(): Flow<List<Checklist>> {
        return Checklist.findByPackingListId(id)
    }
    
    // 持ち物を追加
    suspend fun addItem(name: String, quantity: Int = 1): Item {
        return Item.create(id, name, quantity)
    }
}

@Dao
interface PackingListDao {
    @Query("SELECT * FROM packing_lists ORDER BY updatedAt DESC")
    fun findAll(): Flow<List<PackingList>>
    
    @Query("SELECT * FROM packing_lists ORDER BY updatedAt DESC")
    suspend fun findAllSync(): List<PackingList>
    
    @Query("SELECT * FROM packing_lists WHERE id = :id")
    suspend fun findById(id: Long): PackingList?
    
    @Insert
    suspend fun insert(packingList: PackingList): Long
    
    @Update
    suspend fun update(packingList: PackingList)
    
    @Delete
    suspend fun delete(packingList: PackingList)
}
