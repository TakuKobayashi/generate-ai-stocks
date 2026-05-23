// apps/ios/ARCompanion/Transport/LiveKitStreamer.swift
// ARKit データを LiveKit 経由で Unity Editor へ送信する。

import Foundation
import LiveKit
import ARKit

// ─────────────────────────────────────────────────────────────────
// 接続設定
// ─────────────────────────────────────────────────────────────────

struct StreamerConfig {
    var serverUrl:   String = "ws://192.168.1.100:7880"
    var roomName:    String = "ar-preview"
    var identity:    String = "ios-device"
    var token:       String
    var videoWidth:  Int    = 1280
    var videoHeight: Int    = 720
    var videoFps:    Int    = 30
}

// ─────────────────────────────────────────────────────────────────
// LiveKitStreamer
// ─────────────────────────────────────────────────────────────────

@MainActor
final class LiveKitStreamer: ObservableObject {

    private var room: Room?
    private var cameraTrack: LocalVideoTrack?

    @Published var isConnected = false
    @Published var connectionState: ConnectionState = .disconnected

    // ─── 接続 ───────────────────────────────────────────────────

    func connect(config: StreamerConfig) async throws {
        let r = Room()
        room = r

        // 接続オプション
        let connectOptions = ConnectOptions(
            autoSubscribe: false    // Publisher は Subscribe 不要
        )

        // 映像パブリッシュオプション
        let videoOptions = VideoPublishOptions(
            name     : "ar-camera",
            encoding : VideoEncoding(
                maxBitrate: 2_000_000,
                maxFps    : config.videoFps
            ),
            simulcast: false
        )

        try await r.connect(
            config.serverUrl,
            config.token,
            connectOptions: connectOptions
        )

        isConnected    = true
        connectionState = .connected

        // カメラトラック作成・パブリッシュ
        let cameraCapturer = CameraCapturer(options: CameraCapturerOptions(
            position   : .back,
            preferredPixelFormat: .kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
        ))

        cameraTrack = LocalVideoTrack.createCameraTrack(capturer: cameraCapturer)
        try await r.localParticipant.publishVideoTrack(
            track: cameraTrack!,
            publishOptions: videoOptions
        )

        // セッション状態送信
        try await sendSessionState()
    }

    func disconnect() async {
        await room?.disconnect()
        room           = nil
        isConnected    = false
        connectionState = .disconnected
    }

    // ─── ARFrame 送信 ────────────────────────────────────────────

    func sendFrame(_ data: ARFrameData) {
        guard isConnected, let participant = room?.localParticipant else { return }

        let envelope = Arpreview_V1_Envelope.with {
            $0.frame = Arpreview_V1_ARFrame.with {
                $0.timestampMs = data.timestampMs
                $0.frameNumber = data.frameNumber
                $0.pose = Arpreview_V1_CameraPose.with {
                    $0.position = Arpreview_V1_Vec3.with { $0.x = data.tx; $0.y = data.ty; $0.z = data.tz }
                    $0.rotation = Arpreview_V1_Quaternion.with { $0.x = data.rx; $0.y = data.ry; $0.z = data.rz; $0.w = data.rw }
                }
                $0.intrinsics = Arpreview_V1_CameraIntrinsics.with {
                    $0.fx = data.fx; $0.fy = data.fy
                    $0.ppx = data.ppx; $0.ppy = data.ppy
                    $0.w = data.imageWidth; $0.h = data.imageHeight
                }
                $0.light = Arpreview_V1_LightEstimate.with {
                    $0.averageIntensity  = data.averageIntensity
                    $0.colorTemperature  = data.colorTemperature
                }
            }
        }

        Task {
            guard let bytes = try? envelope.serializedData() else { return }
            try? await participant.publishData(
                data        : bytes,
                reliability : .lossy      // フレームは最新優先
            )
        }
    }

    // ─── プレーン更新送信 ────────────────────────────────────────

    func sendPlanes(_ planes: [ARPlaneInfo]) {
        guard isConnected, !planes.isEmpty,
              let participant = room?.localParticipant else { return }

        let protoPlanes: [Arpreview_V1_PlaneData] = planes.map { p in
            Arpreview_V1_PlaneData.with {
                $0.id    = p.id.uuidString
                $0.event = {
                    switch p.event {
                    case .added:   return .trackingEventAdded
                    case .updated: return .trackingEventUpdated
                    case .removed: return .trackingEventRemoved
                    }
                }()
                $0.alignment = {
                    switch p.alignment {
                    case .horizontal: return .planeAlignmentHorizontalUp
                    case .vertical:   return .planeAlignmentVertical
                    @unknown default: return .planeAlignmentNotAxisAligned
                    }
                }()
                $0.center   = Arpreview_V1_Vec3.with { $0.x = p.center.x; $0.y = p.center.y; $0.z = p.center.z }
                $0.rotation = Arpreview_V1_Quaternion.with {
                    $0.x = p.rotation.vector.x; $0.y = p.rotation.vector.y
                    $0.z = p.rotation.vector.z; $0.w = p.rotation.vector.w
                }
                $0.extents      = Arpreview_V1_Vec2.with { $0.x = p.extentX; $0.y = p.extentZ }
                $0.boundaryXz   = p.boundaryXZ
            }
        }

        let envelope = Arpreview_V1_Envelope.with {
            $0.planes = Arpreview_V1_ARPlaneUpdate.with {
                $0.timestampMs = Int64(Date().timeIntervalSince1970 * 1000)
                $0.planes      = protoPlanes
            }
        }

        Task {
            guard let bytes = try? envelope.serializedData() else { return }
            try? await participant.publishData(
                data        : bytes,
                reliability : .reliable    // プレーンは確実に届ける
            )
        }
    }

    // ─── セッション状態送信 ──────────────────────────────────────

    private func sendSessionState() async throws {
        guard let participant = room?.localParticipant else { return }

        let envelope = Arpreview_V1_Envelope.with {
            $0.session = Arpreview_V1_SessionState.with {
                $0.timestampMs = Int64(Date().timeIntervalSince1970 * 1000)
                $0.status      = .sessionStatusReady
                $0.platform    = .platformIos
                $0.deviceModel = UIDevice.current.model
                $0.osVersion   = UIDevice.current.systemVersion
                $0.arSdkVersion = Bundle.main.object(forInfoDictionaryKey: "ARKitVersion") as? String ?? ""
                $0.features    = ["planes", "light_estimate"]
            }
        }

        guard let bytes = try? envelope.serializedData() else { return }
        try await participant.publishData(data: bytes, reliability: .reliable)
    }
}
