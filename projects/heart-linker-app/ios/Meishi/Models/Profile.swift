import Foundation

final class Profile {
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
        SnsAccount.findAll(table: "profile_sns", parentColumn: "profile_id", parentId: id)
    }

    @discardableResult
    func save() -> Int64 {
        let db = Database.shared
        let params: [SqlValue] = [.text(name), .text(email), .text(phone), .text(address), .opt(iconPath)]
        if id <= 0 {
            db.run("INSERT INTO profile (name, email, phone, address, icon_path) VALUES (?,?,?,?,?)", params)
            id = db.lastInsertRowId()
        } else {
            db.run("UPDATE profile SET name=?, email=?, phone=?, address=?, icon_path=? WHERE id=\(id)", params)
        }
        return id
    }

    // MARK: - Class method (ActiveRecord風)

    /// 自分のプロフィールは1件だけ管理する
    static func current() -> Profile {
        var result: Profile?
        Database.shared.query("SELECT * FROM profile ORDER BY id ASC LIMIT 1") { row in
            result = Profile(id: row.int64(0), name: row.text(1), email: row.text(2),
                             phone: row.text(3), address: row.text(4), iconPath: row.textOrNil(5))
        }
        if let p = result { return p }
        let p = Profile()
        p.save()
        return p
    }
}
