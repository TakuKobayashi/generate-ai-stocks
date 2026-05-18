package com.example.nomikai.data.db

/**
 * ActiveRecordパターンの基底クラス。
 *
 * 各サブクラスは以下を実装する:
 *  - インスタンスメソッド: save() / delete() / その他ドメイン操作
 *  - companion object : find() / all() / where相当のファインダーメソッド
 *
 * Usage:
 * ```kotlin
 * // 保存
 * val user = UserRecord(id = uuid, name = "太郎", fcmToken = token)
 * user.save()
 *
 * // 検索
 * val user   = UserRecord.find(id)
 * val all    = NotificationRecord.all()
 * val unread = NotificationRecord.unread()
 *
 * // 削除
 * notification.delete()
 *
 * // ドメインメソッド
 * notification.markRead()
 * invite.close()
 * ```
 */
abstract class ActiveRecord {

    /**
     * このレコードをDBに永続化する（INSERT OR REPLACE）。
     * @return 挿入された行のrowId。更新の場合は -1。
     */
    abstract suspend fun save(): Long

    /**
     * このレコードをDBから削除する。
     * @return 削除された行数。
     */
    abstract suspend fun delete(): Int
}
