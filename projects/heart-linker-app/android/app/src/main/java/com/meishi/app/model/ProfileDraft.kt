package com.meishi.app.model

import android.content.ContentValues
import android.database.Cursor
import com.meishi.app.db.ActiveRecord

/**
 * 編集画面で入力中の内容を一時保存しておくためのキャッシュ。
 * 「保存」または「元に戻す」を押すと消える。
 */
class ProfileDraft(
    override var id: Long = 0,
    var name: String = "",
    var email: String = "",
    var phone: String = "",
    var address: String = "",
    var iconPath: String? = null
) : ActiveRecord() {

    override val tableName: String = "profile_draft"

    override fun toContentValues(): ContentValues = ContentValues().apply {
        put("name", name)
        put("email", email)
        put("phone", phone)
        put("address", address)
        put("icon_path", iconPath)
    }

    fun snsAccounts(): List<SnsAccount> = SnsAccount.findAllForDraft(id)

    fun clear() {
        SnsAccount.deleteAllFor(SnsAccount.TABLE_DRAFT, SnsAccount.COLUMN_DRAFT_ID, id)
        delete()
    }

    companion object {
        private fun fromCursor(c: Cursor): ProfileDraft = ProfileDraft(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            name = c.getString(c.getColumnIndexOrThrow("name")),
            email = c.getString(c.getColumnIndexOrThrow("email")),
            phone = c.getString(c.getColumnIndexOrThrow("phone")),
            address = c.getString(c.getColumnIndexOrThrow("address")),
            iconPath = c.getString(c.getColumnIndexOrThrow("icon_path"))
        )

        /** 既存の下書きがあれば返す。なければnull */
        fun findExisting(): ProfileDraft? {
            val cursor = rawQuery("SELECT * FROM profile_draft ORDER BY id ASC LIMIT 1")
            cursor.use {
                if (it.moveToFirst()) return fromCursor(it)
            }
            return null
        }

        /** profileの内容から新しい下書きを作る(編集開始時に呼ぶ) */
        fun createFrom(profile: Profile): ProfileDraft {
            val draft = ProfileDraft(
                name = profile.name,
                email = profile.email,
                phone = profile.phone,
                address = profile.address,
                iconPath = profile.iconPath
            )
            draft.save()
            profile.snsAccounts().forEach { sns ->
                SnsAccount.newForDraft(draft.id, sns.type, sns.value, sns.sortOrder).save()
            }
            return draft
        }
    }
}
