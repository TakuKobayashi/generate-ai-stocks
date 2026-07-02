package com.meishi.app.model

import android.content.ContentValues
import android.database.Cursor
import com.meishi.app.db.ActiveRecord

class Contact(
    override var id: Long = 0,
    var name: String = "",
    var email: String = "",
    var phone: String = "",
    var address: String = "",
    var iconPath: String? = null,
    var receivedAt: Long = System.currentTimeMillis()
) : ActiveRecord() {

    override val tableName: String = "contacts"

    override fun toContentValues(): ContentValues = ContentValues().apply {
        put("name", name)
        put("email", email)
        put("phone", phone)
        put("address", address)
        put("icon_path", iconPath)
        put("received_at", receivedAt)
    }

    fun snsAccounts(): List<SnsAccount> = SnsAccount.findAllForContact(id)

    override fun delete() {
        SnsAccount.deleteAllFor(SnsAccount.TABLE_CONTACT, SnsAccount.COLUMN_CONTACT_ID, id)
        super.delete()
    }

    companion object {
        private fun fromCursor(c: Cursor): Contact = Contact(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            name = c.getString(c.getColumnIndexOrThrow("name")),
            email = c.getString(c.getColumnIndexOrThrow("email")),
            phone = c.getString(c.getColumnIndexOrThrow("phone")),
            address = c.getString(c.getColumnIndexOrThrow("address")),
            iconPath = c.getString(c.getColumnIndexOrThrow("icon_path")),
            receivedAt = c.getLong(c.getColumnIndexOrThrow("received_at"))
        )

        fun findAll(): List<Contact> {
            val list = mutableListOf<Contact>()
            val cursor = rawQuery("SELECT * FROM contacts ORDER BY received_at DESC")
            cursor.use {
                while (it.moveToNext()) list.add(fromCursor(it))
            }
            return list
        }

        fun find(id: Long): Contact? {
            val cursor = rawQuery("SELECT * FROM contacts WHERE id = ?", arrayOf(id.toString()))
            cursor.use {
                if (it.moveToFirst()) return fromCursor(it)
            }
            return null
        }
    }
}
