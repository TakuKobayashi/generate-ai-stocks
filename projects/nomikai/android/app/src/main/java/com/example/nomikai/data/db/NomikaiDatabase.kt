package com.example.nomikai.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Room データベース定義。
 * DAOは各ActiveRecordクラスの内部実装として使用し、
 * アプリコードはActiveRecordのインスタンス/クラスメソッドを通じてのみアクセスする。
 */
@Database(
    entities = [
        UserRecord::class,
        NotificationRecord::class,
        DrinkingInviteRecord::class
    ],
    version = 1,
    exportSchema = false
)
abstract class NomikaiDatabase : RoomDatabase() {

    // ActiveRecord内部から参照されるDAO群
    internal abstract fun userDao(): UserDao
    internal abstract fun notificationDao(): NotificationDao
    internal abstract fun drinkingInviteDao(): DrinkingInviteDao

    companion object {
        private const val DB_NAME = "nomikai.db"

        @Volatile
        private var INSTANCE: NomikaiDatabase? = null

        fun create(context: Context): NomikaiDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    NomikaiDatabase::class.java,
                    DB_NAME
                )
                    .fallbackToDestructiveMigration()   // 開発中のスキーマ変更に対応
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
