package com.meishi.app.db

import android.content.ContentValues
import android.database.Cursor
import com.meishi.app.MeishiApp

/**
 * ActiveRecordパターンの基底クラス。
 * 各モデルはこれを継承し、tableName/toContentValues/fromCursorを実装することで
 * save()・delete()といったインスタンスメソッドでDB操作ができるようになる。
 */
abstract class ActiveRecord {
    abstract var id: Long
    abstract val tableName: String

    /** このレコードの値をContentValuesに変換する(idは含めない) */
    abstract fun toContentValues(): ContentValues

    protected fun db() = MeishiDatabase.getInstance(MeishiApp.instance).writableDatabase

    /** 新規ならINSERT、既存ならUPDATEする */
    open fun save(): Long {
        val database = db()
        val values = toContentValues()
        return if (id <= 0) {
            val newId = database.insert(tableName, null, values)
            id = newId
            newId
        } else {
            database.update(tableName, values, "id = ?", arrayOf(id.toString()))
            id.toLong()
        }
    }

    open fun delete() {
        if (id <= 0) return
        db().delete(tableName, "id = ?", arrayOf(id.toString()))
    }

    companion object {
        fun rawQuery(sql: String, args: Array<String> = arrayOf()): Cursor {
            return MeishiDatabase.getInstance(MeishiApp.instance).readableDatabase
                .rawQuery(sql, args)
        }

        fun writableDb() = MeishiDatabase.getInstance(MeishiApp.instance).writableDatabase
    }
}
