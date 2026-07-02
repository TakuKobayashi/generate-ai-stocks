package com.meishi.app.nearby

import android.content.Context
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy

/**
 * 名刺交換用のNearby Connectionsラッパー。
 * 自分のCardPayload(MessagePackバイト列)を、見つかった/接続してきた相手へ自動送信し、
 * 相手から届いたバイト列をonPayloadReceivedで通知する。
 */
class NearbyTransferManager(
    context: Context,
    private val localName: String,
    private val onEndpointFound: (endpointId: String, name: String) -> Unit,
    private val onConnected: (endpointId: String) -> Unit,
    private val onPayloadReceived: (bytes: ByteArray) -> Unit,
    private val onError: (String) -> Unit = {}
) {
    private val client: ConnectionsClient = Nearby.getConnectionsClient(context)
    private var outgoingPayload: ByteArray? = null

    /** これから送る自分の名刺データをセットしておく。接続確立時に自動送信する。 */
    fun setOutgoingPayload(bytes: ByteArray) {
        outgoingPayload = bytes
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            // 名刺交換アプリ同士であれば自動的に受け入れる
            client.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                onConnected(endpointId)
                outgoingPayload?.let { bytes ->
                    client.sendPayload(endpointId, Payload.fromBytes(bytes))
                }
            } else {
                onError("接続に失敗しました")
            }
        }

        override fun onDisconnected(endpointId: String) {
            // 特に何もしない
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                payload.asBytes()?.let { onPayloadReceived(it) }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // 進捗表示が必要であればここでハンドリングする
        }
    }

    fun startAdvertising(serviceId: String) {
        val options = AdvertisingOptions.Builder().setStrategy(Strategy.P2P_POINT_TO_POINT).build()
        client.startAdvertising(localName, serviceId, connectionLifecycleCallback, options)
            .addOnFailureListener { onError("広告の開始に失敗しました: ${it.message}") }
    }

    fun startDiscovery(serviceId: String) {
        val options = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_POINT_TO_POINT).build()
        val endpointCallback = object : com.google.android.gms.nearby.connection.EndpointDiscoveryCallback() {
            override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
                onEndpointFound(endpointId, info.endpointName)
            }

            override fun onEndpointLost(endpointId: String) {
                // 一覧から消す処理は呼び出し側のUI状態で行う
            }
        }
        client.startDiscovery(serviceId, endpointCallback, options)
            .addOnFailureListener { onError("検索の開始に失敗しました: ${it.message}") }
    }

    fun requestConnection(endpointId: String) {
        client.requestConnection(localName, endpointId, connectionLifecycleCallback)
            .addOnFailureListener { onError("接続要求に失敗しました: ${it.message}") }
    }

    fun stopAll() {
        client.stopAdvertising()
        client.stopDiscovery()
        client.stopAllEndpoints()
    }

    companion object {
        /** Nearby上でアプリ同士を見つけるための固定サービスID */
        const val SERVICE_ID = "com.meishi.app.SERVICE_ID"
    }
}
