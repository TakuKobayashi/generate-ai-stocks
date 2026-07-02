package com.meishi.app.db

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * アプリ全体で使用するSQLiteのオープンヘルパー。
 * ActiveRecordパターンの各モデルはこのDBに対してCRUDを行う。
 */
class MeishiDatabase private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        // 自分のプロフィール(確定済み・保存済み)
        db.execSQL(
            """
            CREATE TABLE profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                icon_path TEXT
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE profile_sns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                service_name TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                value TEXT NOT NULL DEFAULT '',
                account_url TEXT,
                account_id TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(profile_id) REFERENCES profile(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )

        // 入力中のキャッシュ(下書き)。保存 or 元に戻すで消える。
        db.execSQL(
            """
            CREATE TABLE profile_draft (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                icon_path TEXT
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE profile_draft_sns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id INTEGER NOT NULL,
                service_name TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                value TEXT NOT NULL DEFAULT '',
                account_url TEXT,
                account_id TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(draft_id) REFERENCES profile_draft(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )

        // 交換して受け取った相手の連絡先一覧
        db.execSQL(
            """
            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                icon_path TEXT,
                received_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE contact_sns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL,
                service_name TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                value TEXT NOT NULL DEFAULT '',
                account_url TEXT,
                account_id TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS profile_sns")
        db.execSQL("DROP TABLE IF EXISTS profile")
        db.execSQL("DROP TABLE IF EXISTS profile_draft_sns")
        db.execSQL("DROP TABLE IF EXISTS profile_draft")
        db.execSQL("DROP TABLE IF EXISTS contact_sns")
        db.execSQL("DROP TABLE IF EXISTS contacts")
        onCreate(db)
    }

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.setForeignKeyConstraintsEnabled(true)
    }

    companion object {
        private const val DB_NAME = "meishi.db"
        private const val DB_VERSION = 1

        @Volatile
        private var instance: MeishiDatabase? = null

        fun getInstance(context: Context): MeishiDatabase {
            return instance ?: synchronized(this) {
                instance ?: MeishiDatabase(context).also { instance = it }
            }
        }
    }
}
