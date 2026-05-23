// apps/ios/ARCompanion/AR/ARKitSession.swift
// ARKit セッションを管理し、毎フレームのデータを AsyncStream で提供する。

import ARKit
import simd
import Foundation

// ─────────────────────────────────────────────────────────────────
// フレームデータ (ARKit → Transport へ渡す中間型)
// ─────────────────────────────────────────────────────────────────

struct ARFrameData {
    let timestampMs: Int64
    let frameNumber: UInt64

    // カメラ姿勢 (Unity 座標系変換済み)
    let tx, ty, tz: Float
    let rx, ry, rz, rw: Float

    // 内部パラメータ
    let fx, fy, ppx, ppy: Float
    let imageWidth, imageHeight: Int32

    // 環境光
    let averageIntensity: Float
    let colorTemperature: Float
}

struct ARPlaneInfo {
    let id: UUID
    let event: PlaneEvent
    let alignment: ARPlaneAnchor.Alignment
    let center: SIMD3<Float>
    let rotation: simd_quatf
    let extentX, extentZ: Float
    let boundaryXZ: [Float]      // interleaved [x0,z0, x1,z1, ...]
}

enum PlaneEvent { case added, updated, removed }

// ─────────────────────────────────────────────────────────────────
// ARKitSession
// ─────────────────────────────────────────────────────────────────

@MainActor
final class ARKitSession: NSObject, ARSessionDelegate {

    private let arSession = ARSession()
    private var frameNumber: UInt64 = 0

    // Continuations for AsyncStream
    private var frameContinuation: AsyncStream<ARFrameData>.Continuation?
    private var planeContinuation: AsyncStream<[ARPlaneInfo]>.Continuation?

    // 前フレームのプレーン (差分用)
    private var trackedPlanes: [UUID: ARPlaneAnchor] = [:]

    // ─── ライフサイクル ──────────────────────────────────────────

    func start() {
        let config = ARWorldTrackingConfiguration()
        config.planeDetection          = [.horizontal, .vertical]
        config.environmentTexturing    = .none
        config.isLightEstimationEnabled = true
        config.frameSemantics          = []

        arSession.delegate = self
        arSession.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func pause() {
        arSession.pause()
    }

    // ─── AsyncStream ファクトリ ──────────────────────────────────

    var frameStream: AsyncStream<ARFrameData> {
        AsyncStream { continuation in
            self.frameContinuation = continuation
        }
    }

    var planeStream: AsyncStream<[ARPlaneInfo]> {
        AsyncStream { continuation in
            self.planeContinuation = continuation
        }
    }

    // ─── ARSessionDelegate ──────────────────────────────────────

    nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard frame.camera.trackingState == .normal else { return }
        Task { @MainActor in
            let data = buildFrameData(frame)
            frameContinuation?.yield(data)
        }
    }

    nonisolated func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        let planes = anchors.compactMap { $0 as? ARPlaneAnchor }
        guard !planes.isEmpty else { return }
        Task { @MainActor in
            let infos = planes.map { buildPlaneInfo($0, event: .added) }
            for p in planes { trackedPlanes[p.identifier] = p }
            planeContinuation?.yield(infos)
        }
    }

    nonisolated func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        let planes = anchors.compactMap { $0 as? ARPlaneAnchor }
        guard !planes.isEmpty else { return }
        Task { @MainActor in
            let infos = planes.map { buildPlaneInfo($0, event: .updated) }
            for p in planes { trackedPlanes[p.identifier] = p }
            planeContinuation?.yield(infos)
        }
    }

    nonisolated func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        let planes = anchors.compactMap { $0 as? ARPlaneAnchor }
        guard !planes.isEmpty else { return }
        Task { @MainActor in
            let infos = planes.map { buildPlaneInfo($0, event: .removed) }
            for p in planes { trackedPlanes.removeValue(forKey: p.identifier) }
            planeContinuation?.yield(infos)
        }
    }

    // ─── ビルダー ────────────────────────────────────────────────

    private func buildFrameData(_ frame: ARFrame) -> ARFrameData {
        let cam  = frame.camera
        // ARKit は右手系 Y-up → Unity 左手系 Y-up
        // カメラの worldTransform (column-major 4x4)
        let t    = cam.transform
        // position
        let tx   =  t.columns.3.x
        let ty   =  t.columns.3.y
        let tz   = -t.columns.3.z   // Z 反転

        // rotation: simd_quatf から取り出して Z 反転
        let mq   = simd_quatf(t)
        let rx   = -mq.vector.x
        let ry   = -mq.vector.y
        let rz   =  mq.vector.z
        let rw   =  mq.vector.w

        // 内部パラメータ
        let intr = cam.intrinsics
        let sz   = cam.imageResolution

        // 環境光
        let light    = frame.lightEstimate
        let lum      = Float(light?.ambientIntensity ?? 0) / 1000.0   // lux 正規化
        let temp     = Float(light?.ambientColorTemperature ?? 6500)

        let data = ARFrameData(
            timestampMs   : Int64(frame.timestamp * 1000),
            frameNumber   : frameNumber,
            tx: tx, ty: ty, tz: tz,
            rx: rx, ry: ry, rz: rz, rw: rw,
            fx  : intr[0][0], fy  : intr[1][1],
            ppx : intr[2][0], ppy : intr[2][1],
            imageWidth    : Int32(sz.width),
            imageHeight   : Int32(sz.height),
            averageIntensity: lum,
            colorTemperature: temp,
        )
        frameNumber += 1
        return data
    }

    private func buildPlaneInfo(_ anchor: ARPlaneAnchor, event: PlaneEvent) -> ARPlaneInfo {
        let t   = anchor.transform
        let tx  =  t.columns.3.x
        let ty  =  t.columns.3.y
        let tz  = -t.columns.3.z

        let mq  = simd_quatf(t)
        let rx  = -mq.vector.x
        let ry  = -mq.vector.y
        let rz  =  mq.vector.z
        let rw  =  mq.vector.w

        // Boundary polygon (plane 局所座標 XZ)
        var bxz = [Float]()
        for v in anchor.geometry.boundaryVertices {
            bxz.append(v.x)
            bxz.append(v.z)
        }

        return ARPlaneInfo(
            id        : anchor.identifier,
            event     : event,
            alignment : anchor.alignment,
            center    : SIMD3(tx, ty, tz),
            rotation  : simd_quatf(vector: SIMD4(rx, ry, rz, rw)),
            extentX   : anchor.planeExtent.width,
            extentZ   : anchor.planeExtent.height,
            boundaryXZ: bxz,
        )
    }
}
