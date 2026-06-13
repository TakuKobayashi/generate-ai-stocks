package com.offlinechat.data.database

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase

abstract class ActiveRecord<T : ActiveRecord<T>> {

    abstract val tableName: String
    abstract val primaryKey: String
    protected lateinit var db: SQLiteDatabase

    fun setDatabase(database: SQLiteDatabase) { db = database }

    abstract fun toContentValues(): ContentValues
    abstract fun fromCursor(cursor: Cursor): T
    abstract fun getPrimaryKeyValue(): Any

    fun save(): Boolean = runCatching {
        val values = toContentValues()
        val id = getPrimaryKeyValue()
        if (exists(id)) db.update(tableName, values, "$primaryKey = ?", arrayOf(id.toString()))
        else db.insert(tableName, null, values)
        true
    }.getOrDefault(false)

    fun delete(): Boolean = runCatching {
        db.delete(tableName, "$primaryKey = ?", arrayOf(getPrimaryKeyValue().toString())) > 0
    }.getOrDefault(false)

    private fun exists(id: Any): Boolean {
        val c = db.query(tableName, arrayOf(primaryKey), "$primaryKey = ?", arrayOf(id.toString()), null, null, null)
        return c.use { it.count > 0 }
    }

    protected fun findById(id: Any): T? {
        val c = db.query(tableName, null, "$primaryKey = ?", arrayOf(id.toString()), null, null, null)
        return c.use { if (it.moveToFirst()) fromCursor(it) else null }
    }

    protected fun findAll(selection: String? = null, selectionArgs: Array<String>? = null, orderBy: String? = null): List<T> {
        val c = db.query(tableName, null, selection, selectionArgs, null, null, orderBy)
        return c.use { cur -> buildList { while (cur.moveToNext()) add(fromCursor(cur)) } }
    }

    protected fun findOne(selection: String, selectionArgs: Array<String>): T? {
        val c = db.query(tableName, null, selection, selectionArgs, null, null, null, "1")
        return c.use { if (it.moveToFirst()) fromCursor(it) else null }
    }

    protected fun rawQuery(sql: String, args: Array<String>? = null): List<T> {
        val c = db.rawQuery(sql, args)
        return c.use { cur -> buildList { while (cur.moveToNext()) add(fromCursor(cur)) } }
    }
}

fun Cursor.strOrNull(col: String): String? = getColumnIndex(col).takeIf { it >= 0 && !isNull(it) }?.let { getString(it) }
fun Cursor.intOr(col: String, default: Int = 0): Int = getColumnIndex(col).takeIf { it >= 0 }?.let { getInt(it) } ?: default
fun Cursor.longOr(col: String, default: Long = 0L): Long = getColumnIndex(col).takeIf { it >= 0 }?.let { getLong(it) } ?: default
fun Cursor.boolOr(col: String, default: Boolean = false): Boolean = intOr(col, if (default) 1 else 0) == 1
