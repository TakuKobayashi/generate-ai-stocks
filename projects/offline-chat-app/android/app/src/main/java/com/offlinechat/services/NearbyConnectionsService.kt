package com.offlinechat.services

import android.content.Context
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

class NearbyConnectionsService(private val context: Context) {

    private val client = Nearby.getConnectionsClient(context)
    private val serviceId = "com.offlinechat.nearby"

    data class PeerInfo(
        val endpointId: String,
        val userId: String,
        val displayName: String,
        val iconPath: String? = null,
        val bio: String? = null
    )

    private val _discovered = MutableStateFlow<Map<String, PeerInfo>>(emptyMap())
    val discovered: StateFlow<Map<String, PeerInfo>> = _discovered

    private val _connected = MutableStateFlow<Map<String, PeerInfo>>(emptyMap())
    val connected: StateFlow<Map<String, PeerInfo>> = _connected

    var onMessage: ((endpointId: String, bytes: ByteArray) -> Unit)? = null
    var onFileReceived: ((endpointId: String, payloadId: Long, uri: android.net.Uri?) -> Unit)? = null

    private var localUserId = ""
    private var localDisplayName = ""
    private var localIconPath: String? = null
    private var localBio: String? = null

    // ─── Callbacks ───────────────────────────────────────────────────────────

    private val connectionLifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            // 常に接続を受け入れる
            client.acceptConnection(endpointId, payloadCallback)
        }
        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                val peer = _discovered.value[endpointId]
                    ?: PeerInfo(endpointId, endpointId, endpointId)
                _connected.value = _connected.value + (endpointId to peer)
            }
        }
        override fun onDisconnected(endpointId: String) {
            _connected.value = _connected.value - endpointId
        }
    }

    private val discoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            val peer = parseEndpointName(endpointId, info.endpointName)
            _discovered.value = _discovered.value + (endpointId to peer)
            // 発見したら自動的に接続要求
            client.requestConnection(buildEndpointName(), endpointId, connectionLifecycle)
        }
        override fun onEndpointLost(endpointId: String) {
            _discovered.value = _discovered.value - endpointId
            _connected.value = _connected.value - endpointId
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            when (payload.type) {
                Payload.Type.BYTES -> payload.asBytes()?.let { onMessage?.invoke(endpointId, it) }
                Payload.Type.FILE -> {
                    val uri = payload.asFile()?.asUri()
                    onFileReceived?.invoke(endpointId, payload.id, uri)
                }
                else -> {}
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    fun startAll(userId: String, displayName: String, iconPath: String? = null, bio: String? = null) {
        localUserId = userId
        localDisplayName = displayName
        localIconPath = iconPath
        localBio = bio

        val name = buildEndpointName()

        // P2P_CLUSTER が WiFi-Aware / WiFi-Direct / Bluetooth を自動選択 (最大距離優先)
        client.startAdvertising(
            name, serviceId, connectionLifecycle,
            AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        )
        client.startDiscovery(
            serviceId, discoveryCallback,
            DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        )
    }

    fun stopAll() {
        client.stopAdvertising()
        client.stopDiscovery()
        client.stopAllEndpoints()
        _connected.value = emptyMap()
        _discovered.value = emptyMap()
    }

    fun sendBytes(endpointId: String, data: ByteArray) {
        client.sendPayload(endpointId, Payload.fromBytes(data))
    }

    fun sendFile(endpointId: String, fileUri: android.net.Uri) {
        val pfd = context.contentResolver.openFileDescriptor(fileUri, "r") ?: return
        client.sendPayload(endpointId, Payload.fromFile(pfd))
    }

    fun endpointIdForUser(userId: String): String? =
        _connected.value.entries.firstOrNull { it.value.userId == userId }?.key
            ?: _discovered.value.entries.firstOrNull { it.value.userId == userId }?.key

    // ─── Private helpers ─────────────────────────────────────────────────────

    private fun buildEndpointName(): String = JSONObject().apply {
        put("uid", localUserId)
        put("name", localDisplayName)
        put("icon", localIconPath ?: "")
        put("bio", localBio ?: "")
    }.toString()

    private fun parseEndpointName(endpointId: String, raw: String): PeerInfo = runCatching {
        val j = JSONObject(raw)
        PeerInfo(
            endpointId = endpointId,
            userId = j.getString("uid"),
            displayName = j.getString("name"),
            iconPath = j.optString("icon").ifEmpty { null },
            bio = j.optString("bio").ifEmpty { null }
        )
    }.getOrElse { PeerInfo(endpointId, endpointId, raw) }
}
