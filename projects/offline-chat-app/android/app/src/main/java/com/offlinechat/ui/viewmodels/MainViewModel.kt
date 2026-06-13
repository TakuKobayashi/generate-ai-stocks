package com.offlinechat.ui.viewmodels

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.offlinechat.data.database.DatabaseHelper
import com.offlinechat.data.models.*
import com.offlinechat.services.NearbyConnectionsService
import com.offlinechat.utils.FileHelper
import com.offlinechat.utils.NotificationHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.UUID

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = DatabaseHelper.getInstance(application).writableDatabase
    val nearby = NearbyConnectionsService(application)
    private val notif = NotificationHelper(application)

    private val _me = MutableStateFlow<User?>(null)
    val me: StateFlow<User?> = _me

    private val _nearbyPeers = MutableStateFlow<List<NearbyPeer>>(emptyList())
    val nearbyPeers: StateFlow<List<NearbyPeer>> = _nearbyPeers

    private val _chatRooms = MutableStateFlow<List<ChatRoom>>(emptyList())
    val chatRooms: StateFlow<List<ChatRoom>> = _chatRooms

    private val _currentRoom = MutableStateFlow<ChatRoom?>(null)
    val currentRoom: StateFlow<ChatRoom?> = _currentRoom

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages

    private val _pendingRequests = MutableStateFlow<List<IncomingRequest>>(emptyList())
    val pendingRequests: StateFlow<List<IncomingRequest>> = _pendingRequests

    data class IncomingRequest(
        val requestId: String,
        val fromUserId: String,
        val fromDisplayName: String,
        val endpointId: String
    )

    // ─── Init ─────────────────────────────────────────────────────────────────

    init {
        viewModelScope.launch(Dispatchers.IO) {
            initUser()
            loadChatRooms()
        }
        viewModelScope.launch {
            nearby.connected.collect { endpoints ->
                withContext(Dispatchers.IO) { syncNearbyPeers(endpoints) }
            }
        }
        nearby.onMessage = { endpointId, bytes ->
            viewModelScope.launch(Dispatchers.IO) { handleIncoming(endpointId, bytes) }
        }
    }

    // ─── User Init ────────────────────────────────────────────────────────────

    private suspend fun initUser() {
        val user = User.firstOrNull(db) ?: User(
            displayName = "User${(1000..9999).random()}"
        ).also {
            it.setDatabase(db)
            it.save()
        }
        _me.value = user
        startNearby(user)
    }

    private fun startNearby(user: User) {
        if (user.isDiscoverable) {
            nearby.startAll(user.id, user.displayName, user.iconPath, user.bio)
        }
    }

    // ─── Nearby Sync ──────────────────────────────────────────────────────────

    private suspend fun syncNearbyPeers(endpoints: Map<String, NearbyConnectionsService.PeerInfo>) {
        NearbyPeer.cleanup(db, System.currentTimeMillis() - 120_000)
        endpoints.values.forEach { ep ->
            val peer = NearbyPeer(ep.endpointId, ep.userId, ep.displayName, ep.iconPath, ep.bio)
            peer.setDatabase(db)
            peer.save()
            // ユーザーレコードも更新
            val u = User.find(ep.userId, db) ?: User(id = ep.userId, displayName = ep.displayName)
            u.displayName = ep.displayName
            u.iconPath = ep.iconPath
            u.bio = ep.bio
            u.setDatabase(db)
            u.save()
        }
        _nearbyPeers.value = NearbyPeer.all(db)
        loadChatRooms()
    }

    // ─── Chat Rooms ───────────────────────────────────────────────────────────

    fun loadChatRooms() {
        viewModelScope.launch(Dispatchers.IO) {
            val ids = _nearbyPeers.value.map { it.userId }
            _chatRooms.value = ChatRoom.allSortedWithNearby(ids, db)
        }
    }

    fun selectRoom(room: ChatRoom) {
        _currentRoom.value = room
        viewModelScope.launch(Dispatchers.IO) {
            _messages.value = Message.findByChatRoom(room.id, db)
            Message.markAsRead(room.id, db)
            room.unreadCount = 0
            room.save()
            loadChatRooms()
        }
    }

    fun openChatWith(peerUserId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val room = ChatRoom.findByPeerUserId(peerUserId, db) ?: run {
                val r = ChatRoom(peerUserId = peerUserId, isRequestPending = true)
                r.setDatabase(db)
                r.save()
                // 接続リクエストを送信
                nearby.endpointIdForUser(peerUserId)?.let { epId ->
                    val payload = JSONObject().apply {
                        put("type", "chat_request")
                        put("uid", _me.value?.id ?: "")
                        put("name", _me.value?.displayName ?: "")
                    }.toString()
                    nearby.sendBytes(epId, payload.toByteArray())
                }
                r
            }
            _currentRoom.value = room
            _messages.value = Message.findByChatRoom(room.id, db)
        }
    }

    // ─── Send ─────────────────────────────────────────────────────────────────

    fun sendText(text: String) {
        val room = _currentRoom.value ?: return
        val myId = _me.value?.id ?: return
        viewModelScope.launch(Dispatchers.IO) {
            val msg = Message(chatRoomId = room.id, senderId = myId,
                messageType = MessageType.TEXT, content = text, isSent = true)
            msg.setDatabase(db)
            msg.save()
            room.lastMessage = text
            room.lastMessageTime = msg.createdAt
            room.save()

            nearby.endpointIdForUser(room.peerUserId)?.let { ep ->
                nearby.sendBytes(ep, buildMessagePayload(msg).toByteArray())
            }
            refreshMessages(room.id)
            loadChatRooms()
        }
    }

    fun sendImage(uri: Uri) {
        val room = _currentRoom.value ?: return
        val myId = _me.value?.id ?: return
        val ctx = getApplication<Application>()
        viewModelScope.launch(Dispatchers.IO) {
            val path = FileHelper.saveToInternalStorage(ctx, uri)
            val msg = Message(chatRoomId = room.id, senderId = myId,
                messageType = MessageType.IMAGE, filePath = path, isSent = true)
            msg.setDatabase(db)
            msg.save()
            room.lastMessage = "[画像]"
            room.lastMessageTime = msg.createdAt
            room.save()

            nearby.endpointIdForUser(room.peerUserId)?.let { ep ->
                nearby.sendFile(ep, uri)
            }
            refreshMessages(room.id)
            loadChatRooms()
        }
    }

    // ─── Receive ──────────────────────────────────────────────────────────────

    private suspend fun handleIncoming(endpointId: String, bytes: ByteArray) {
        val json = runCatching { JSONObject(String(bytes)) }.getOrNull() ?: return
        when (json.optString("type")) {
            "chat_request" -> handleChatRequest(endpointId, json)
            "chat_request_accept" -> handleChatRequestAccept(json)
            "message" -> handleMessage(json)
        }
    }

    private suspend fun handleChatRequest(endpointId: String, json: JSONObject) {
        val fromId = json.optString("uid")
        val fromName = json.optString("name")
        val req = IncomingRequest(UUID.randomUUID().toString(), fromId, fromName, endpointId)
        _pendingRequests.value = _pendingRequests.value + req
        withContext(Dispatchers.Main) { notif.showChatRequest(fromName) }
    }

    fun acceptRequest(req: IncomingRequest) {
        viewModelScope.launch(Dispatchers.IO) {
            val room = ChatRoom.findByPeerUserId(req.fromUserId, db) ?: run {
                val r = ChatRoom(peerUserId = req.fromUserId, isRequestAccepted = true)
                r.setDatabase(db)
                r.save()
                r
            }
            room.isRequestAccepted = true
            room.isRequestPending = false
            room.save()
            _pendingRequests.value = _pendingRequests.value.filter { it.requestId != req.requestId }

            val reply = JSONObject().apply {
                put("type", "chat_request_accept")
                put("uid", _me.value?.id ?: "")
            }.toString()
            nearby.sendBytes(req.endpointId, reply.toByteArray())
            loadChatRooms()
        }
    }

    fun declineRequest(req: IncomingRequest) {
        _pendingRequests.value = _pendingRequests.value.filter { it.requestId != req.requestId }
    }

    private suspend fun handleChatRequestAccept(json: JSONObject) {
        val fromId = json.optString("uid")
        val room = ChatRoom.findByPeerUserId(fromId, db) ?: return
        room.isRequestPending = false
        room.isRequestAccepted = true
        room.save()
        if (_currentRoom.value?.peerUserId == fromId) {
            _currentRoom.value = room
        }
        loadChatRooms()
    }

    private suspend fun handleMessage(json: JSONObject) {
        val fromId = json.optString("uid")
        val content = json.optString("content")
        val type = runCatching { MessageType.valueOf(json.optString("msgType", "TEXT")) }.getOrDefault(MessageType.TEXT)

        val room = ChatRoom.findByPeerUserId(fromId, db) ?: run {
            val r = ChatRoom(peerUserId = fromId, isRequestAccepted = true)
            r.setDatabase(db)
            r.save()
            r
        }
        val msg = Message(chatRoomId = room.id, senderId = fromId,
            messageType = type, content = content, isDelivered = true)
        msg.setDatabase(db)
        msg.save()

        room.lastMessage = content
        room.lastMessageTime = msg.createdAt
        if (_currentRoom.value?.id != room.id) {
            room.unreadCount += 1
            withContext(Dispatchers.Main) {
                val sender = User.find(fromId, db)
                notif.showMessage(sender?.displayName ?: "メッセージ", content, room.id)
            }
        }
        room.save()

        if (_currentRoom.value?.id == room.id) refreshMessages(room.id)
        loadChatRooms()
    }

    // ─── Profile ──────────────────────────────────────────────────────────────

    fun updateProfile(displayName: String, bio: String?, iconPath: String?) {
        viewModelScope.launch(Dispatchers.IO) {
            _me.value?.let { user ->
                user.displayName = displayName
                user.bio = bio
                user.iconPath = iconPath
                user.save()
                _me.value = user
                nearby.stopAll()
                startNearby(user)
            }
        }
    }

    fun setDiscoverable(discoverable: Boolean) {
        viewModelScope.launch(Dispatchers.IO) {
            _me.value?.let { user ->
                user.isDiscoverable = discoverable
                user.save()
                _me.value = user
                if (discoverable) startNearby(user) else nearby.stopAll()
            }
        }
    }

    fun deleteChatRoom(room: ChatRoom) {
        viewModelScope.launch(Dispatchers.IO) {
            room.delete()
            db.delete("messages", "chat_room_id = ?", arrayOf(room.id))
            loadChatRooms()
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private suspend fun refreshMessages(roomId: String) {
        _messages.value = Message.findByChatRoom(roomId, db)
    }

    private fun buildMessagePayload(msg: Message) = JSONObject().apply {
        put("type", "message")
        put("uid", msg.senderId)
        put("msgType", msg.messageType.name)
        put("content", msg.content ?: "")
    }.toString()

    fun peerUserForRoom(room: ChatRoom): User? = User.find(room.peerUserId, db)

    fun isNearby(userId: String) = _nearbyPeers.value.any { it.userId == userId }

    override fun onCleared() {
        super.onCleared()
        nearby.stopAll()
    }
}
