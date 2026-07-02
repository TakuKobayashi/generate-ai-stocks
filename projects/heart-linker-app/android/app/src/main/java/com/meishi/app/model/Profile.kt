package com.meishi.app.model

import android.content.ContentValues
import android.database.Cursor
import com.meishi.app.db.ActiveRecord

class Profile(
    override var id: Long = 0,
    var name: String = "",
    var email: String = "",
    var phone: String = "",
    var address: String = "",
    var iconPath: String? = null
) : ActiveRecord() {

    override val tableName: String = "profile"

    override fun toContentValues(): ContentValues = ContentValues().apply {
        put("name", name)
        put("email", email)
        put("phone", phone)
        put("address", address)
        put("icon_path", iconPath)
    }

    fun snsAccounts(): List<SnsAccount> = SnsAccount.findAllForProfile(id)

    companion object {
        private fun fromCursor(c: Cursor): Profile = Profile(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            name = c.getString(c.getColumnIndexOrThrow("name")),
            email = c.getString(c.getColumnIndexOrThrow("email")),
            phone = c.getString(c.getColumnIndexOrThrow("phone")),
            address = c.getString(c.getColumnIndexOrThrow("address")),
            iconPath = c.getString(c.getColumnIndexOrThrow("icon_path"))
        )

        /** 自分のプロフィールは1件のみ。存在しなければ作成する。 */
        fun current(): Profile {
            val cursor = rawQuery("SELECT * FROM profile ORDER BY id ASC LIMIT 1")
            cursor.use {
                if (it.moveToFirst()) return fromCursor(it)
            }
            val p = Profile()
            p.save()
            return p
        }
    }
}
