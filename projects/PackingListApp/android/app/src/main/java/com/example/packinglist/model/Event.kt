package com.example.packinglist.model

import androidx.room.*
import com.example.packinglist.data.AppDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "events")
data class Event(
    @PrimaryKey
    var id: String, // Google Calendar Event ID
    var title: String,
    var startTime: Long,
    var endTime: Long,
    var location: String = "",
    var description: String = "",
    var calendarId: String = ""
) {
    companion object {
        // 全ての予定を取得
        fun findAll(): Flow<List<Event>> {
            return AppDatabase.getInstance().eventDao().findAll()
        }
        
        // IDで予定を取得
        suspend fun findById(id: String): Event? {
            return AppDatabase.getInstance().eventDao().findById(id)
        }
        
        // 予定を作成
        suspend fun create(
            id: String,
            title: String,
            startTime: Long,
            endTime: Long,
            location: String = "",
            description: String = "",
            calendarId: String = ""
        ): Event {
            val event = Event(id, title, startTime, endTime, location, description, calendarId)
            event.save()
            return event
        }
        
        // 複数の予定を一括挿入
        suspend fun insertAll(events: List<Event>) {
            AppDatabase.getInstance().eventDao().insertAll(events)
        }
    }
    
    // 保存（新規作成または更新）
    suspend fun save() {
        AppDatabase.getInstance().eventDao().insert(this)
    }
    
    // 削除
    suspend fun delete() {
        AppDatabase.getInstance().eventDao().delete(this)
    }
    
    // この予定に紐付けられた持ち物リストを取得
    fun packingLists(): Flow<List<PackingList>> {
        return AppDatabase.getInstance().eventDao().getPackingListsForEvent(id)
    }
    
    // この予定に持ち物リストを紐付け
    suspend fun linkPackingList(packingListId: Long) {
        val link = EventPackingList(id, packingListId)
        AppDatabase.getInstance().eventDao().linkEventToPackingList(link)
    }
    
    // この予定から持ち物リストの紐付けを解除
    suspend fun unlinkPackingList(packingListId: Long) {
        val link = EventPackingList(id, packingListId)
        AppDatabase.getInstance().eventDao().unlinkEventFromPackingList(link)
    }
    
    // この予定に紐付けられた持ち物リストのIDリストを取得
    suspend fun packingListIds(): List<Long> {
        return AppDatabase.getInstance().eventDao().getPackingListIdsForEvent(id)
    }
}

@Dao
interface EventDao {
    @Query("SELECT * FROM events ORDER BY startTime ASC")
    fun findAll(): Flow<List<Event>>
    
    @Query("SELECT * FROM events WHERE id = :id")
    suspend fun findById(id: String): Event?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(event: Event)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(events: List<Event>)
    
    @Delete
    suspend fun delete(event: Event)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun linkEventToPackingList(eventPackingList: EventPackingList)
    
    @Delete
    suspend fun unlinkEventFromPackingList(eventPackingList: EventPackingList)
    
    @Query("""
        SELECT packing_lists.* FROM packing_lists
        INNER JOIN event_packing_lists ON packing_lists.id = event_packing_lists.packingListId
        WHERE event_packing_lists.eventId = :eventId
    """)
    fun getPackingListsForEvent(eventId: String): Flow<List<PackingList>>
    
    @Query("SELECT packingListId FROM event_packing_lists WHERE eventId = :eventId")
    suspend fun getPackingListIdsForEvent(eventId: String): List<Long>
}
