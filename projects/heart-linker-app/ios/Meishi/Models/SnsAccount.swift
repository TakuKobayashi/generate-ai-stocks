import Foundation

// MARK: - SnsAccount

/// SNSアカウント1件。3テーブル (profile_sns / profile_draft_sns / contact_sns) を
/// table / parentColumn を切り替えることで同一クラスで扱う ActiveRecord パターン。
final class SnsAccount {
    var id: Int64 = 0
    var parentId: Int64
    var snsType: SnsType
    var value: String
    var serviceName: String   // type == .other のときにユーザーが入力した自由なサービス名
    var accountUrl: String?
    var accountId: String?
    var sortOrder: Int

    private let table: String
    private let parentColumn: String

    init(id: Int64 = 0,
         parentId: Int64,
         snsType: SnsType,
         value: String,
         serviceName: String = "",
         accountUrl: String? = nil,
         accountId: String? = nil,
         sortOrder: Int = 0,
         table: String,
         parentColumn: String) {
        self.id = id
        self.parentId = parentId
        self.snsType = snsType
        self.value = value
        self.serviceName = serviceName
        self.accountUrl = accountUrl
        self.accountId = accountId
        self.sortOrder = sortOrder
        self.table = table
        self.parentColumn = parentColumn
    }

    /// 表示名: OTHER のときはユーザー入力名、それ以外は固定名
    var displayLabel: String {
        snsType == .other && !serviceName.isEmpty ? serviceName : snsType.displayName
    }

    // MARK: Save / Delete

    @discardableResult
    func save() -> Int64 {
        let db = Database.shared
        let params: [SqlValue] = [
            .int(parentId), .text(snsType.rawValue), .text(value),
            .text(serviceName), .opt(accountUrl), .opt(accountId), .int(Int64(sortOrder))
        ]
        if id <= 0 {
            db.run("""
                INSERT INTO \(table) (\(parentColumn), type, value, service_name, account_url, account_id, sort_order)
                VALUES (?,?,?,?,?,?,?)
                """, params)
            id = db.lastInsertRowId()
        } else {
            db.run("""
                UPDATE \(table) SET \(parentColumn)=?, type=?, value=?, service_name=?, account_url=?, account_id=?, sort_order=?
                WHERE id=\(id)
                """, params)
        }
        return id
    }

    func delete() {
        guard id > 0 else { return }
        Database.shared.run("DELETE FROM \(table) WHERE id=?", [.int(id)])
    }

    // MARK: - Factory

    static func forProfile(profileId: Int64, snsType: SnsType, value: String, sortOrder: Int, serviceName: String = "") -> SnsAccount {
        SnsAccount(parentId: profileId, snsType: snsType, value: value, serviceName: serviceName, sortOrder: sortOrder,
                   table: "profile_sns", parentColumn: "profile_id")
    }
    static func forDraft(draftId: Int64, snsType: SnsType, value: String, sortOrder: Int, serviceName: String = "") -> SnsAccount {
        SnsAccount(parentId: draftId, snsType: snsType, value: value, serviceName: serviceName, sortOrder: sortOrder,
                   table: "profile_draft_sns", parentColumn: "draft_id")
    }
    static func forContact(contactId: Int64, snsType: SnsType, value: String, sortOrder: Int,
                           serviceName: String = "", accountUrl: String? = nil, accountId: String? = nil) -> SnsAccount {
        SnsAccount(parentId: contactId, snsType: snsType, value: value, serviceName: serviceName,
                   accountUrl: accountUrl, accountId: accountId, sortOrder: sortOrder,
                   table: "contact_sns", parentColumn: "contact_id")
    }

    // MARK: - Query helpers

    static func findAll(table: String, parentColumn: String, parentId: Int64) -> [SnsAccount] {
        var rows: [SnsAccount] = []
        Database.shared.query(
            "SELECT * FROM \(table) WHERE \(parentColumn)=? ORDER BY sort_order",
            [.int(parentId)]
        ) { row in
            rows.append(SnsAccount(
                id: row.int64(0),
                parentId: row.int64(1),
                snsType: SnsType(rawValue: row.text(3)) ?? .other,   // col3 = type
                value: row.text(4),                                    // col4 = value
                serviceName: row.text(2),                              // col2 = service_name
                accountUrl: row.textOrNil(5),
                accountId: row.textOrNil(6),
                sortOrder: row.int(7),
                table: table, parentColumn: parentColumn
            ))
        }
        return rows
    }

    static func deleteAll(table: String, parentColumn: String, parentId: Int64) {
        Database.shared.run("DELETE FROM \(table) WHERE \(parentColumn)=?", [.int(parentId)])
    }
}
