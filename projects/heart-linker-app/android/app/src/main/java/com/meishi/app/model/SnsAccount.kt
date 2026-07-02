package com.meishi.app.model

import android.content.ContentValues
import android.database.Cursor
import com.meishi.app.db.ActiveRecord

/**
 * SNSアカウント1件分のActiveRecord。
 * table/parentColumnを切り替えることで profile_sns / profile_draft_sns / contact_sns
 * の3テーブルを同じクラスで扱う。
 *
 * value: 編集画面でユーザーが入力する生のテキスト(URLでもIDでも可)。
 * serviceName: typeがOTHERの場合にユーザーが入力するSNS名。
 * accountUrl/accountId: MessagePack交換時に value から推定して埋める(送受信用)。
 */
class SnsAccount(
    override var id: Long = 0,
    var parentId: Long = 0,
    var type: SnsType = SnsType.WEBSITE,
    var value: String = "",
    var serviceName: String = "",
    var accountUrl: String? = null,
    var accountId: String? = null,
    var sortOrder: Int = 0,
    private val table: String = TABLE_PROFILE,
    private val parentColumn: String = COLUMN_PROFILE_ID
) : ActiveRecord() {

    override val tableName: String get() = table

    override fun toContentValues(): ContentValues = ContentValues().apply {
        put(parentColumn, parentId)
        put("type", type.typeKey)
        put("value", value)
        put("service_name", serviceName)
        put("account_url", accountUrl)
        put("account_id", accountId)
        put("sort_order", sortOrder)
    }

    /** 表示名(OTHER種別ならユーザー入力名、それ以外は固定名) */
    fun displayLabel(): String = if (type == SnsType.OTHER && serviceName.isNotBlank()) serviceName else type.displayName

    companion object {
        const val TABLE_PROFILE = "profile_sns"
        const val TABLE_DRAFT = "profile_draft_sns"
        const val TABLE_CONTACT = "contact_sns"

        const val COLUMN_PROFILE_ID = "profile_id"
        const val COLUMN_DRAFT_ID = "draft_id"
        const val COLUMN_CONTACT_ID = "contact_id"

        private fun fromCursor(c: Cursor, table: String, parentColumn: String): SnsAccount {
            return SnsAccount(
                id = c.getLong(c.getColumnIndexOrThrow("id")),
                parentId = c.getLong(c.getColumnIndexOrThrow(parentColumn)),
                type = SnsType.fromKey(c.getString(c.getColumnIndexOrThrow("type"))),
                value = c.getString(c.getColumnIndexOrThrow("value")),
                serviceName = c.getString(c.getColumnIndexOrThrow("service_name")),
                accountUrl = c.getString(c.getColumnIndexOrThrow("account_url")),
                accountId = c.getString(c.getColumnIndexOrThrow("account_id")),
                sortOrder = c.getInt(c.getColumnIndexOrThrow("sort_order")),
                table = table,
                parentColumn = parentColumn
            )
        }

        fun findAllForProfile(profileId: Long) =
            findAllFor(TABLE_PROFILE, COLUMN_PROFILE_ID, profileId)

        fun findAllForDraft(draftId: Long) =
            findAllFor(TABLE_DRAFT, COLUMN_DRAFT_ID, draftId)

        fun findAllForContact(contactId: Long) =
            findAllFor(TABLE_CONTACT, COLUMN_CONTACT_ID, contactId)

        private fun findAllFor(table: String, parentColumn: String, parentId: Long): List<SnsAccount> {
            val list = mutableListOf<SnsAccount>()
            val cursor = rawQuery(
                "SELECT * FROM $table WHERE $parentColumn = ? ORDER BY sort_order ASC",
                arrayOf(parentId.toString())
            )
            cursor.use {
                while (it.moveToNext()) {
                    list.add(fromCursor(it, table, parentColumn))
                }
            }
            return list
        }

        fun deleteAllFor(table: String, parentColumn: String, parentId: Long) {
            writableDb().delete(table, "$parentColumn = ?", arrayOf(parentId.toString()))
        }

        fun newForProfile(profileId: Long, type: SnsType, value: String, sortOrder: Int, serviceName: String = "") =
            SnsAccount(parentId = profileId, type = type, value = value, serviceName = serviceName, sortOrder = sortOrder,
                table = TABLE_PROFILE, parentColumn = COLUMN_PROFILE_ID)

        fun newForDraft(draftId: Long, type: SnsType, value: String, sortOrder: Int, serviceName: String = "") =
            SnsAccount(parentId = draftId, type = type, value = value, serviceName = serviceName, sortOrder = sortOrder,
                table = TABLE_DRAFT, parentColumn = COLUMN_DRAFT_ID)

        fun newForContact(
            contactId: Long,
            type: SnsType,
            value: String,
            sortOrder: Int,
            serviceName: String = "",
            accountUrl: String? = null,
            accountId: String? = null
        ) = SnsAccount(
            parentId = contactId, type = type, value = value, serviceName = serviceName,
            accountUrl = accountUrl, accountId = accountId, sortOrder = sortOrder,
            table = TABLE_CONTACT, parentColumn = COLUMN_CONTACT_ID
        )
    }
}
