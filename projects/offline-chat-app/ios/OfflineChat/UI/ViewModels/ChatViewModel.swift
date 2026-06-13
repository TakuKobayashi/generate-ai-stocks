import Foundation
import Combine
import MultipeerConnectivity

@MainActor
final class ChatViewModel: ObservableObject {

    // MARK: - Published
    @Published var me: UserModel?
    @Published var nearbyPeers: [MultipeerService.PeerInfo] = []
    @Published var chatRooms: [ChatRoomModel] = []
    @Published var currentRoom: ChatRoomModel?
    @Published var messages: [MessageModel] = []
    @Published var pendingRequests: [IncomingRequest] = []

    struct IncomingRequest: Identifiable {
        let id = UUID()
        let requestId: String
        let fromUserId: String
        let fromDisplayName: String
        let peerId: MCPeerID
    }

    // MARK: - Services
    let multipeer = MultipeerService()
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Init
    init() {
        Task { await initUser() }

        multipeer.$discovered
            .receive(on: DispatchQueue.main)
            .sink { [weak self] peers in
                self?.nearbyPeers = peers
                self?.loadChatRooms()
            }
            .store(in: &cancellables)

        multipeer.onData = { [weak self] peer, data in
            Task { await self?.handleIncoming(peer: peer, data: data) }
        }
    }

    // MARK: - User Init

    private func initUser() async {
        let user = UserModel.first() ?? {
            let u = UserModel(displayName: "User\(Int.random(in: 1000...9999))")
            u.save()
            return u
        }()
        me = user
        multipeer.start(userId: user.id, displayName: user.displayName,
                        iconPath: user.iconPath, bio: user.bio)
    }

    // MARK: - Rooms

    func loadChatRooms() {
        let ids = nearbyPeers.map { $0.userId }
        chatRooms = ChatRoomModel.allSorted(nearbyIds: ids)
    }

    func selectRoom(_ room: ChatRoomModel) {
        currentRoom = room
        messages = MessageModel.findByRoom(room.id)
        MessageModel.markAsRead(roomId: room.id)
        var updated = room
        updated.unreadCount = 0
        updated.save()
        loadChatRooms()
    }

    func openChatWith(userId: String) {
        var room = ChatRoomModel.findByPeer(peerUserId: userId) ?? {
            let r = ChatRoomModel(peerUserId: userId, isRequestPending: true)
            r.save()
            // リクエスト送信
            if let peer = multipeer.peerIdForUser(userId),
               let myId = me?.id, let myName = me?.displayName {
                let payload = ["type": "chat_request", "uid": myId, "name": myName]
                if let data = try? JSONSerialization.data(withJSONObject: payload) {
                    multipeer.sendData(data, to: peer)
                }
            }
            return r
        }()
        currentRoom = room
        messages = MessageModel.findByRoom(room.id)
        loadChatRooms()
    }

    // MARK: - Send

    func sendText(_ text: String) {
        guard let room = currentRoom, let myId = me?.id else { return }
        let msg = MessageModel(chatRoomId: room.id, senderId: myId,
                               messageType: .text, content: text, isSent: true)
        msg.save()
        var updated = room
        updated.lastMessage = text
        updated.lastMessageTime = msg.createdAt
        updated.save()
        currentRoom = updated

        if let peer = multipeer.peerIdForUser(room.peerUserId) {
            let payload: [String: Any] = ["type": "message", "uid": myId,
                                          "msgType": "TEXT", "content": text]
            if let data = try? JSONSerialization.data(withJSONObject: payload) {
                multipeer.sendData(data, to: peer)
            }
        }
        messages = MessageModel.findByRoom(room.id)
        loadChatRooms()
    }

    // MARK: - Receive

    private func handleIncoming(peer: MCPeerID, data: Data) async {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        let type = json["type"] as? String ?? ""

        switch type {
        case "chat_request":
            let fromId = json["uid"] as? String ?? ""
            let fromName = json["name"] as? String ?? peer.displayName
            let req = IncomingRequest(requestId: UUID().uuidString,
                                      fromUserId: fromId, fromDisplayName: fromName, peerId: peer)
            pendingRequests.append(req)

        case "chat_request_accept":
            let fromId = json["uid"] as? String ?? ""
            if var room = ChatRoomModel.findByPeer(peerUserId: fromId) {
                room.isRequestPending = false
                room.isRequestAccepted = true
                room.save()
                if currentRoom?.peerUserId == fromId { currentRoom = room }
                loadChatRooms()
            }

        case "message":
            let fromId = json["uid"] as? String ?? ""
            let content = json["content"] as? String ?? ""
            let msgTypeRaw = json["msgType"] as? String ?? "TEXT"
            let msgType = MessageType(rawValue: msgTypeRaw) ?? .text

            var room = ChatRoomModel.findByPeer(peerUserId: fromId) ?? {
                let r = ChatRoomModel(peerUserId: fromId, isRequestAccepted: true)
                r.save()
                return r
            }()
            let msg = MessageModel(chatRoomId: room.id, senderId: fromId,
                                   messageType: msgType, content: content, isDelivered: true)
            msg.save()
            room.lastMessage = content
            room.lastMessageTime = msg.createdAt
            if currentRoom?.id != room.id { room.unreadCount += 1 }
            room.save()

            if currentRoom?.id == room.id { messages = MessageModel.findByRoom(room.id) }
            loadChatRooms()

        default: break
        }
    }

    func acceptRequest(_ req: IncomingRequest) {
        var room = ChatRoomModel.findByPeer(peerUserId: req.fromUserId) ?? {
            let r = ChatRoomModel(peerUserId: req.fromUserId, isRequestAccepted: true)
            r.save()
            return r
        }()
        room.isRequestAccepted = true
        room.isRequestPending = false
        room.save()
        pendingRequests.removeAll { $0.id == req.id }

        if let myId = me?.id {
            let payload: [String: Any] = ["type": "chat_request_accept", "uid": myId]
            if let data = try? JSONSerialization.data(withJSONObject: payload) {
                multipeer.sendData(data, to: req.peerId)
            }
        }
        loadChatRooms()
    }

    func declineRequest(_ req: IncomingRequest) {
        pendingRequests.removeAll { $0.id == req.id }
    }

    // MARK: - Profile

    func updateProfile(displayName: String, bio: String?, iconPath: String?) {
        guard var user = me else { return }
        user.displayName = displayName
        user.bio = bio
        user.iconPath = iconPath
        user.save()
        me = user
        multipeer.stop()
        multipeer.start(userId: user.id, displayName: user.displayName,
                        iconPath: user.iconPath, bio: user.bio)
    }

    func setDiscoverable(_ value: Bool) {
        guard var user = me else { return }
        user.isDiscoverable = value
        user.save()
        me = user
        if value {
            multipeer.start(userId: user.id, displayName: user.displayName,
                            iconPath: user.iconPath, bio: user.bio)
        } else {
            multipeer.stop()
        }
    }

    func deleteChatRoom(_ room: ChatRoomModel) {
        room.delete()
        loadChatRooms()
    }

    // MARK: - Helpers

    func peerUser(for room: ChatRoomModel) -> UserModel? { UserModel.find(id: room.peerUserId) }
    func isNearby(_ userId: String) -> Bool { nearbyPeers.contains(where: { $0.userId == userId }) }
}
