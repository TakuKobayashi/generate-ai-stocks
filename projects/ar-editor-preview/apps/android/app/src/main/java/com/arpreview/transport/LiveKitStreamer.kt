// apps/android/app/src/main/java/com/arpreview/transport/LiveKitStreamer.kt
// ARCore データを LiveKit 経由で Unity Editor へ送信する。
// Video Track (カメラ映像) + Data Channel (Protobuf メタデータ) の 2 チャネル。

package com.arpreview.transport

import android.content.Context
import android.util.Log
import com.arpreview.ar.ARFrameData
import com.arpreview.ar.ARPlaneData
import com.arpreview.ar.PlaneEventType
import com.arpreview.proto.*
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.participant.LocalParticipant
import io.livekit.android.room.track.CameraPosition
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.LocalVideoTrackOptions
import io.livekit.android.room.track.video.Camera2Capturer
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

private const val TAG = "LiveKitStreamer"

// ─────────────────────────────────────────────────────────────────
// 接続設定
// ─────────────────────────────────────────────────────────────────

data class StreamerConfig(
    val serverUrl: String = "ws://192.168.1.100:7880",
    val roomName:  String = "ar-preview",
    val identity:  String = "android-device",
    val token:     String,             // LiveKit JWT トークン
    val videoWidth:  Int = 1280,
    val videoHeight: Int = 720,
    val videoFps:    Int = 30,
)

// ─────────────────────────────────────────────────────────────────
// LiveKitStreamer
// ─────────────────────────────────────────────────────────────────

class LiveKitStreamer(private val context: Context) {

    private val scope       = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var room: Room? = null
    private var videoTrack: LocalVideoTrack? = null

    // 接続状態
    val isConnected: Boolean get() =
        room?.state == Room.State.CONNECTED

    // ─── 接続 ───────────────────────────────────────────────────

    suspend fun connect(config: StreamerConfig): Result<Unit> = runCatching {
        val lkRoom = LiveKit.create(context).apply {
            room = this
        }

        // ルームイベント監視
        scope.launch {
            lkRoom.events.collect { event ->
                when (event) {
                    is RoomEvent.Connected    -> Log.i(TAG, "✅ Connected to ${config.roomName}")
                    is RoomEvent.Disconnected -> Log.w(TAG, "❌ Disconnected: ${event.error}")
                    is RoomEvent.Reconnecting -> Log.i(TAG, "🔄 Reconnecting...")
                    else -> {}
                }
            }
        }

        lkRoom.connect(config.serverUrl, config.token)

        // カメラ映像パブリッシュ
        publishVideo(lkRoom.localParticipant, config)

        // セッション状態を送信
        sendSessionState(lkRoom.localParticipant, config.identity)
    }

    suspend fun disconnect() {
        videoTrack?.stop()
        videoTrack = null
        room?.disconnect()
        room = null
    }

    fun destroy() {
        scope.cancel()
    }

    // ─── 映像パブリッシュ ────────────────────────────────────────

    private suspend fun publishVideo(participant: LocalParticipant, config: StreamerConfig) {
        val track = participant.createVideoTrack(
            name    = "ar-camera",
            options = LocalVideoTrackOptions(
                position = CameraPosition.BACK,
                captureParams = VideoCaptureParameter(
                    width     = config.videoWidth,
                    height    = config.videoHeight,
                    maxFps    = config.videoFps,
                )
            )
        )
        track.startCapture()
        participant.publishVideoTrack(track)
        videoTrack = track
        Log.i(TAG, "Video track published: ${config.videoWidth}x${config.videoHeight}@${config.videoFps}fps")
    }

    // ─── ARFrame 送信 ────────────────────────────────────────────

    fun sendFrame(data: ARFrameData) {
        val participant = room?.localParticipant ?: return

        val envelope = Envelope(
            frame = ARFrame(
                timestamp_ms = data.timestampMs,
                frame_number = data.frameNumber.toULong(),
                pose = CameraPose(
                    position = Vec3(x = data.tx, y = data.ty, z = data.tz),
                    rotation = Quaternion(x = data.rx, y = data.ry, z = data.rz, w = data.rw),
                ),
                intrinsics = CameraIntrinsics(
                    fx  = data.fx,  fy  = data.fy,
                    ppx = data.ppx, ppy = data.ppy,
                    w   = data.imageWidth,
                    h   = data.imageHeight,
                ),
                light = LightEstimate(
                    average_intensity  = data.averageLuminance,
                    color_temperature  = data.colorTemperature,
                ),
            )
        )

        scope.launch {
            try {
                participant.publishData(
                    data      = envelope.encode(),
                    reliability = DataPublishReliability.LOSSY,  // フレームデータは最新優先
                )
            } catch (e: Exception) {
                Log.w(TAG, "sendFrame error: ${e.message}")
            }
        }
    }

    // ─── プレーン更新送信 ────────────────────────────────────────

    fun sendPlanes(planes: List<ARPlaneData>) {
        if (planes.isEmpty()) return
        val participant = room?.localParticipant ?: return

        val protoPlanes = planes.map { p ->
            PlaneData(
                id             = p.id,
                event          = when (p.event) {
                    PlaneEventType.ADDED   -> TrackingEventType.TRACKING_EVENT_ADDED
                    PlaneEventType.UPDATED -> TrackingEventType.TRACKING_EVENT_UPDATED
                    PlaneEventType.REMOVED -> TrackingEventType.TRACKING_EVENT_REMOVED
                },
                tracking_state = TrackingState.TRACKING_STATE_TRACKING,
                alignment      = when (p.alignment.ordinal) {
                    0 -> PlaneAlignment.PLANE_ALIGNMENT_HORIZONTAL_UP
                    1 -> PlaneAlignment.PLANE_ALIGNMENT_HORIZONTAL_DOWN
                    2 -> PlaneAlignment.PLANE_ALIGNMENT_VERTICAL
                    else -> PlaneAlignment.PLANE_ALIGNMENT_NOT_AXIS_ALIGNED
                },
                center         = Vec3(x = p.cx, y = p.cy, z = p.cz),
                rotation       = Quaternion(x = p.rx, y = p.ry, z = p.rz, w = p.rw),
                extents        = Vec2(x = p.extentX, y = p.extentZ),
                boundary_xz    = p.boundaryXZ.toList(),
                subsumed_by_id = p.subsumedById ?: "",
            )
        }

        val envelope = Envelope(
            planes = ARPlaneUpdate(
                timestamp_ms = System.currentTimeMillis(),
                planes       = protoPlanes,
            )
        )

        scope.launch {
            try {
                participant.publishData(
                    data        = envelope.encode(),
                    reliability = DataPublishReliability.RELIABLE,  // プレーンは確実に届ける
                )
            } catch (e: Exception) {
                Log.w(TAG, "sendPlanes error: ${e.message}")
            }
        }
    }

    // ─── セッション状態送信 ──────────────────────────────────────

    private suspend fun sendSessionState(participant: LocalParticipant, identity: String) {
        val envelope = Envelope(
            session = SessionState(
                timestamp_ms   = System.currentTimeMillis(),
                status         = SessionStatus.SESSION_STATUS_READY,
                platform       = Platform.PLATFORM_ANDROID,
                device_model   = android.os.Build.MODEL,
                os_version     = android.os.Build.VERSION.RELEASE,
                ar_sdk_version = com.google.ar.core.ArCoreApk.getInstance()
                    .checkAvailability(context).name,
                features       = listOf("planes", "light_estimate"),
            )
        )

        try {
            participant.publishData(
                data        = envelope.encode(),
                reliability = DataPublishReliability.RELIABLE,
            )
            Log.i(TAG, "Session state sent")
        } catch (e: Exception) {
            Log.w(TAG, "sendSessionState error: ${e.message}")
        }
    }
}
