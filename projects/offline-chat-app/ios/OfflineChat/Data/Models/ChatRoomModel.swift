import Foundation

struct ChatRoomModel: Identifiable, Equatable {
    var id: String
    var peerUserId: String
    var lastMessage: String?
    var lastMessageTime: Int64?
    var unreadCount: Int
    var isRequestPending: Bool
    var isRequestAccepted: Bool
    var createdAt: Int64
    var updatedAt: Int64

    init(id: String = UUID().uuidString, peerUserId: String,
         lastMessage: String? = nil, lastMessageTime: Int64? = nil,
         unreadCount: Int = 0, isRequestPending: Bool = false,
         isRequestAccepted: Bool = false,
         createdAt: Int64 = Int64(Date().timeIntervalSince1970),
         updatedAt: Int64 = Int64(Date().timeIntervalSince1970)) {
        self.id = id; self.peerUserId = peerUserId; self.lastMessage = lastMessage
        self.lastMessageTime = lastMessageTime; self.unreadCount = unreadCount
        self.isRequestPending = isRequestPending; self.isRequestAccepted = isRequestAccepted
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }

    func save() {
        let now = Int64(Date().timeIntervalSince1970)
        DatabaseManager.shared.run("""
        INSERT OR REPLACE INTO chat_rooms
        (id,peer_user_id,last_message,last_message_time,unread_count,is_request_pending,is_request_accepted,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)
        """, args: [id, peerUserId, lastMessage, lastMessageTime, unreadCount,
                    isRequestPending, isRequestAccepted, createdAt, now])
    }

    func delete() {
        DatabaseManager.shared.exec("DELETE FROM chat_rooms WHERE id='\(id)'")
        DatabaseManager.shared.exec("DELETE FROM messages WHERE chat_room_id='\(id)'")
    }

    static func find(id: String) -> ChatRoomModel? {
        DatabaseManager.shared.query("SELECT * FROM chat_rooms WHERE id=?", args: [id]).first.map(fromRow)
    }

    static func findByPeer(peerUserId: String) -> ChatRoomModel? {
        DatabaseManager.shared.query("SELECT * FROM chat_rooms WHERE peer_user_id=?", args: [peerUserId]).first.map(fromRow)
    }

    static func allSorted(nearbyIds: [String]) -> [ChatRoomModel] {
        if nearbyIds.isEmpty {
            return DatabaseManager.shared.query(
                "SELECT * FROM chat_rooms ORDER BY COALESCE(last_message_time,0) DESC"
            ).map(fromRow)
        }
        let inClause = nearbyIds.map { "'\($0.replacingOccurrences(of: "'", with: "''"))'" }.joined(separator: ",")
        return DatabaseManager.shared.query("""
        SELECT * FROM chat_rooms
        ORDER BY CASE WHEN peer_user_id IN (\(inClause)) THEN 0 ELSE 1 END,
                 COALESCE(last_message_time,0) DESC
        """).map(fromRow)
    }

    static func fromRow(_ row: [String: Any]) -> ChatRoomModel {
        ChatRoomModel(
            id: row["id"] as? String ?? "",
            peerUserId: row["peer_user_id"] as? String ?? "",
            lastMessage: row["last_message"] as? String,
            lastMessageTime: (row["last_message_time"] as? Int).map(Int64.init),
            unreadCount: row["unread_count"] as? Int ?? 0,
            isRequestPending: (row["is_request_pending"] as? Int ?? 0) == 1,
            isRequestAccepted: (row["is_request_accepted"] as? Int ?? 0) == 1,
            createdAt: Int64(row["created_at"] as? Int ?? 0),
            updatedAt: Int64(row["updated_at"] as? Int ?? 0)
        )
    }
}
