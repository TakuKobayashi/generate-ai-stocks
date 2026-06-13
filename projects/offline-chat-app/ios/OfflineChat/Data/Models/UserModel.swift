import Foundation

struct UserModel: Identifiable, Equatable {
    var id: String
    var displayName: String
    var bio: String?
    var iconPath: String?
    var isDiscoverable: Bool
    var createdAt: Int64
    var updatedAt: Int64

    init(id: String = UUID().uuidString, displayName: String,
         bio: String? = nil, iconPath: String? = nil,
         isDiscoverable: Bool = true,
         createdAt: Int64 = Int64(Date().timeIntervalSince1970),
         updatedAt: Int64 = Int64(Date().timeIntervalSince1970)) {
        self.id = id; self.displayName = displayName; self.bio = bio
        self.iconPath = iconPath; self.isDiscoverable = isDiscoverable
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }

    // MARK: - Persistence
    func save() {
        let db = DatabaseManager.shared
        let now = Int64(Date().timeIntervalSince1970)
        db.run("""
        INSERT OR REPLACE INTO users (id,display_name,bio,icon_path,is_discoverable,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?)
        """, args: [id, displayName, bio, iconPath, isDiscoverable, createdAt, now])
    }

    static func find(id: String) -> UserModel? {
        DatabaseManager.shared.query("SELECT * FROM users WHERE id=?", args: [id]).first.map(fromRow)
    }

    static func all() -> [UserModel] {
        DatabaseManager.shared.query("SELECT * FROM users").map(fromRow)
    }

    static func first() -> UserModel? { all().first }

    static func fromRow(_ row: [String: Any]) -> UserModel {
        UserModel(
            id: row["id"] as? String ?? "",
            displayName: row["display_name"] as? String ?? "",
            bio: row["bio"] as? String,
            iconPath: row["icon_path"] as? String,
            isDiscoverable: (row["is_discoverable"] as? Int ?? 1) == 1,
            createdAt: Int64(row["created_at"] as? Int ?? 0),
            updatedAt: Int64(row["updated_at"] as? Int ?? 0)
        )
    }
}
