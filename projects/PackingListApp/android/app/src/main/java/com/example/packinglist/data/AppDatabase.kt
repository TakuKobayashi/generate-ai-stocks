package com.example.packinglist.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.packinglist.model.*

@Database(
    entities = [
        PackingList::class,
        Item::class,
        Event::class,
        EventPackingList::class,
        Checklist::class,
        ChecklistItem::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun packingListDao(): PackingListDao
    abstract fun itemDao(): ItemDao
    abstract fun eventDao(): EventDao
    abstract fun checklistDao(): ChecklistDao
    abstract fun checklistItemDao(): ChecklistItemDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "packing_list_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
        
        fun getInstance(): AppDatabase {
            return INSTANCE ?: throw IllegalStateException("Database not initialized")
        }
    }
}
