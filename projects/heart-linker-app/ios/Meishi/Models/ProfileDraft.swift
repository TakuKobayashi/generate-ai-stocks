import Foundation

/// 編集中のプロフィールを一時保存するキャッシュ。
/// 「保存」または「元に戻す」で clear() して消す。
final class ProfileDraft {
    var id: Int64 = 0
    var name: String
    var email: String
    var phone: String
    var address: String
    var iconPath: String?

    init(id: Int64 = 0, name: String = "", email: String = "",
         phone: String = "", address: String = "", iconPath: String? = nil) {
        self.id = id; self.name = name; self.email = email
        self.phone = phone; self.address = address; self.iconPath = iconPath
    }

    func snsAccounts() -> [SnsAccount] {
        SnsAccount.findAll(table: "profile_draft_sns", parentColumn: "draft_id", parentId: id)
    }

    @discardableResult
    func save() -> Int64 {
        let db = Database.shared
        let params: [SqlValue] = [.text(name), .text(email), .text(phone), .text(address), .opt(iconPath)]
        if id <= 0 {
            db.run("INSERT INTO profile_draft (name, email, phone, address, icon_path) VALUES (?,?,?,?,?)", params)
            id = db.lastInsertRowId()
        } else {
            db.run("UPDATE profile_draft SET name=?, email=?, phone=?, address=?, icon_path=? WHERE id=\(id)", params)
        }
        return id
    }

    func clear() {
        SnsAccount.deleteAll(table: "profile_draft_sns", parentColumn: "draft_id", parentId: id)
        Database.shared.run("DELETE FROM profile_draft WHERE id=?", [.int(id)])
    }

    // MARK: - Class methods

    static func findExisting() -> ProfileDraft? {
        var result: ProfileDraft?
        Database.shared.query("SELECT * FROM profile_draft ORDER BY id ASC LIMIT 1") { row in
            result = ProfileDraft(id: row.int64(0), name: row.text(1), email: row.text(2),
                                  phone: row.text(3), address: row.text(4), iconPath: row.textOrNil(5))
        }
        return result
    }

    static func createFrom(_ profile: Profile) -> ProfileDraft {
        let draft = ProfileDraft(name: profile.name, email: profile.email,
                                 phone: profile.phone, address: profile.address, iconPath: profile.iconPath)
        draft.save()
        profile.snsAccounts().forEach { sns in
            SnsAccount.forDraft(draftId: draft.id, snsType: sns.snsType, value: sns.value,
                                sortOrder: sns.sortOrder, serviceName: sns.serviceName).save()
        }
        return draft
    }
}
