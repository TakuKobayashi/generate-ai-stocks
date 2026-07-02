package com.example.ais.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.example.ais.data.dao.GoalDao
import com.example.ais.data.dao.InterventionLogDao
import com.example.ais.data.entity.Goal
import com.example.ais.data.entity.InterventionLog
import com.example.ais.data.entity.TriggerType

@Database(
    entities = [Goal::class, InterventionLog::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(AISConverters::class)
abstract class AISDatabase : RoomDatabase() {
    abstract fun goalDao(): GoalDao
    abstract fun interventionLogDao(): InterventionLogDao

    companion object {
        const val DATABASE_NAME = "ais.db"
    }
}

class AISConverters {
    @TypeConverter
    fun fromTriggerType(type: TriggerType): String = type.name

    @TypeConverter
    fun toTriggerType(name: String): TriggerType = TriggerType.valueOf(name)
}
