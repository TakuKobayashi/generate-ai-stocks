package com.offlinechat.data.database

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class DatabaseHelper private constructor(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "offline_chat.db"
        private const val DATABASE_VERSION = 1

        @Volatile
        private var instance: DatabaseHelper? = null

        fun getInstance(context: Context): DatabaseHelper =
            instance ?: synchronized(this) {
                instance ?: DatabaseHelper(context.applicationContext).also { instance = it }
            }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE users (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                bio TEXT,
                icon_path TEXT,
                is_discoverable INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"""
        )
        db.execSQL(
            """CREATE TABLE chat_rooms (
                id TEXT PRIMARY KEY,
                peer_user_id TEXT NOT NULL,
                last_message TEXT,
                last_message_time INTEGER,
                unread_count INTEGER DEFAULT 0,
                is_request_pending INTEGER DEFAULT 0,
                is_request_accepted INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )"""
        )
        db.execSQL(
            """CREATE TABLE messages (
                id TEXT PRIMARY KEY,
                chat_room_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                content TEXT,
                file_path TEXT,
                file_name TEXT,
                file_size INTEGER,
                is_sent INTEGER DEFAULT 0,
                is_delivered INTEGER DEFAULT 0,
                is_read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )"""
        )
        db.execSQL(
            """CREATE TABLE nearby_peers (
                endpoint_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                icon_path TEXT,
                bio TEXT,
                last_seen INTEGER NOT NULL
            )"""
        )
        db.execSQL("CREATE INDEX idx_messages_room ON messages(chat_room_id, created_at)")
        db.execSQL("CREATE INDEX idx_rooms_peer ON chat_rooms(peer_user_id)")
        db.execSQL("CREATE INDEX idx_nearby_seen ON nearby_peers(last_seen)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.setForeignKeyConstraintsEnabled(true)
    }
}
