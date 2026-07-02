import Foundation

final class Contact: Identifiable, Hashable {
    static func == (lhs: Contact, rhs: Contact) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    var id: Int64 = 0
    var name: String
    var email: String
    var phone: String
    var address: String
    var iconPath: String?
    var receivedAt: Date

    init(id: Int64 = 0, name: String = "", email: String = "",
         phone: String = "", address: String = "", iconPath: String? = nil,
         receivedAt: Date = Date()) {
        self.id = id; self.name = name; self.email = email
        self.phone = phone; self.address = address; self.iconPath = iconPath
        self.receivedAt = receivedAt
    }

    func snsAccounts() -> [SnsAccount] {
        SnsAccount.findAll(table: "contact_sns", parentColumn: "contact_id", parentId: id)
    }

    @discardableResult
    func save() -> Int64 {
        let db = Database.shared
        let ts = Int64(receivedAt.timeIntervalSince1970 * 1000)
        let params: [SqlValue] = [.text(name), .text(email), .text(phone), .text(address), .opt(iconPath), .int(ts)]
        if id <= 0 {
            db.run("INSERT INTO contacts (name, email, phone, address, icon_path, received_at) VALUES (?,?,?,?,?,?)", params)
            id = db.lastInsertRowId()
        } else {
            db.run("UPDATE contacts SET name=?, email=?, phone=?, address=?, icon_path=?, received_at=? WHERE id=\(id)", params)
        }
        return id
    }

    func delete() {
        SnsAccount.deleteAll(table: "contact_sns", parentColumn: "contact_id", parentId: id)
        Database.shared.run("DELETE FROM contacts WHERE id=?", [.int(id)])
    }

    // MARK: - Class methods

    static func findAll() -> [Contact] {
        var rows: [Contact] = []
        Database.shared.query("SELECT * FROM contacts ORDER BY received_at DESC") { row in
            rows.append(Contact(
                id: row.int64(0), name: row.text(1), email: row.text(2),
                phone: row.text(3), address: row.text(4), iconPath: row.textOrNil(5),
                receivedAt: Date(timeIntervalSince1970: TimeInterval(row.int64(6)) / 1000)
            ))
        }
        return rows
    }

    static func find(_ id: Int64) -> Contact? {
        var result: Contact?
        Database.shared.query("SELECT * FROM contacts WHERE id=?", [.int(id)]) { row in
            result = Contact(
                id: row.int64(0), name: row.text(1), email: row.text(2),
                phone: row.text(3), address: row.text(4), iconPath: row.textOrNil(5),
                receivedAt: Date(timeIntervalSince1970: TimeInterval(row.int64(6)) / 1000)
            )
        }
        return result
    }
}
