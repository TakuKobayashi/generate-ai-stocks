import Foundation

enum MessageType: String, Codable {
    case text = "TEXT"
    case image = "IMAGE"
    case file = "FILE"
    case audio = "AUDIO"
    case chatRequest = "CHAT_REQUEST"
    case chatRequestAccept = "CHAT_REQUEST_ACCEPT"
}

struct MessageModel: Identifiable, Equatable {
    var id: String
    var chatRoomId: String
    var senderId: String
    var messageType: MessageType
    var content: String?
    var filePath: String?
    var fileName: String?
    var fileSize: Int?
    var isSent: Bool
    var isDelivered: Bool
    var isRead: Bool
    var createdAt: Int64

    init(id: String = UUID().uuidString, chatRoomId: String, senderId: String,
         messageType: MessageType = .text, content: String? = nil,
         filePath: String? = nil, fileName: String? = nil, fileSize: Int? = nil,
         isSent: Bool = false, isDelivered: Bool = false, isRead: Bool = false,
         createdAt: Int64 = Int64(Date().timeIntervalSince1970)) {
        self.id = id; self.chatRoomId = chatRoomId; self.senderId = senderId
        self.messageType = messageType; self.content = content
        self.filePath = filePath; self.fileName = fileName; self.fileSize = fileSize
        self.isSent = isSent; self.isDelivered = isDelivered; self.isRead = isRead
        self.createdAt = createdAt
    }

    func save() {
        DatabaseManager.shared.run("""
        INSERT OR REPLACE INTO messages
        (id,chat_room_id,sender_id,message_type,content,file_path,file_name,file_size,is_sent,is_delivered,is_read,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, args: [id, chatRoomId, senderId, messageType.rawValue, content,
                    filePath, fileName, fileSize, isSent, isDelivered, isRead, createdAt])
    }

    static func findByRoom(_ roomId: String, limit: Int = 100) -> [MessageModel] {
        DatabaseManager.shared.query(
            "SELECT * FROM messages WHERE chat_room_id=? ORDER BY created_at ASC LIMIT ?",
            args: [roomId, limit]
        ).map(fromRow)
    }

    static func markAsRead(roomId: String) {
        DatabaseManager.shared.exec("UPDATE messages SET is_read=1 WHERE chat_room_id='\(roomId)' AND is_read=0")
    }

    static func fromRow(_ row: [String: Any]) -> MessageModel {
        MessageModel(
            id: row["id"] as? String ?? "",
            chatRoomId: row["chat_room_id"] as? String ?? "",
            senderId: row["sender_id"] as? String ?? "",
            messageType: MessageType(rawValue: row["message_type"] as? String ?? "TEXT") ?? .text,
            content: row["content"] as? String,
            filePath: row["file_path"] as? String,
            fileName: row["file_name"] as? String,
            fileSize: row["file_size"] as? Int,
            isSent: (row["is_sent"] as? Int ?? 0) == 1,
            isDelivered: (row["is_delivered"] as? Int ?? 0) == 1,
            isRead: (row["is_read"] as? Int ?? 0) == 1,
            createdAt: Int64(row["created_at"] as? Int ?? 0)
        )
    }
}
