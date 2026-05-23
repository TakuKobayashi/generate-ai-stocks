// packages/unity/Runtime/Subsystems/EditorPreviewSubsystems.cs
// AR Foundation の XR サブシステム実装。
// AREditorPreviewManager からデータを取り出して AR Foundation へ注入する。

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SubsystemsImplementation;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using AREditorPreview.Core;
using AREditorPreview.Proto;

namespace AREditorPreview.Subsystems
{
    // ═════════════════════════════════════════════════════════════
    // Session Subsystem
    // ═════════════════════════════════════════════════════════════

    public sealed class EditorPreviewSessionSubsystem : XRSessionSubsystem
    {
        public const string k_SubsystemId = "AREditorPreview-Session";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void Register()
        {
            var info = new XRSessionSubsystemDescriptor.Cinfo
            {
                id                   = k_SubsystemId,
                providerType         = typeof(SessionProvider),
                subsystemTypeOverride = typeof(EditorPreviewSessionSubsystem),
                supportsInstallation = false,
            };
            XRSessionSubsystemDescriptor.RegisterDescriptor(info);
        }

        class SessionProvider : Provider
        {
            public override TrackingState trackingState
            {
                get
                {
                    var mgr = AREditorPreviewManager.Instance;
                    if (mgr == null || !mgr.IsConnected) return TrackingState.None;
                    return mgr.SessionStatus switch
                    {
                        SessionStatus.SessionStatusTracking => TrackingState.Tracking,
                        SessionStatus.SessionStatusLimited  => TrackingState.Limited,
                        _ => TrackingState.None,
                    };
                }
            }

            public override NotTrackingReason notTrackingReason
            {
                get
                {
                    var session = AREditorPreviewManager.Instance?.LatestSession;
                    if (session == null) return NotTrackingReason.Initializing;
                    return session.LimitedReason switch
                    {
                        LimitedReason.LimitedReasonExcessiveMotion       => NotTrackingReason.ExcessiveMotion,
                        LimitedReason.LimitedReasonInsufficientFeatures  => NotTrackingReason.InsufficientFeatures,
                        LimitedReason.LimitedReasonInsufficientLight     => NotTrackingReason.None,
                        LimitedReason.LimitedReasonRelocalizing          => NotTrackingReason.Relocalizing,
                        _ => NotTrackingReason.Initializing,
                    };
                }
            }

            public override Promise<SessionInstallationStatus> InstallAsync()
                => Promise<SessionInstallationStatus>.CreateResolvedPromise(SessionInstallationStatus.Success);

            public override Promise<SessionAvailability> GetAvailabilityAsync()
                => Promise<SessionAvailability>.CreateResolvedPromise(SessionAvailability.Supported | SessionAvailability.Installed);
        }
    }

    // ═════════════════════════════════════════════════════════════
    // Camera Subsystem
    // ═════════════════════════════════════════════════════════════

    public sealed class EditorPreviewCameraSubsystem : XRCameraSubsystem
    {
        public const string k_SubsystemId = "AREditorPreview-Camera";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void Register()
        {
            var cameraTextureDescriptor = new XRCameraSubsystemDescriptor.Cinfo
            {
                id                           = k_SubsystemId,
                providerType                 = typeof(CameraProvider),
                subsystemTypeOverride        = typeof(EditorPreviewCameraSubsystem),
                supportsAverageBrightness    = true,
                supportsColorTemperature     = true,
                supportsCameraGrain          = false,
                supportsProjectionMatrix     = true,
                supportsDisplayMatrix        = false,
                supportsFocusModes           = false,
                supportsCameraImage          = false,   // 将来: CPU Image
                supportsTimestamp            = true,
            };
            XRCameraSubsystemDescriptor.Register(cameraTextureDescriptor);
        }

        class CameraProvider : Provider
        {
            private Material _cameraMaterial;

            // カメラ姿勢
            public override bool TryGetFrame(XRCameraParams cameraParams, out XRCameraFrame cameraFrame)
            {
                var mgr = AREditorPreviewManager.Instance;
                if (mgr == null || mgr.LatestFrame == null)
                {
                    cameraFrame = default;
                    return false;
                }

                var frame = mgr.LatestFrame;
                var pose  = frame.Pose;

                cameraFrame = new XRCameraFrame(
                    timestampNs: frame.TimestampMs * 1_000_000L,
                    averageBrightness: frame.Light?.AverageIntensity ?? 0f,
                    averageColorTemperature: frame.Light?.ColorTemperature ?? 6500f,
                    colorCorrection: Color.white,
                    projectionMatrix: frame.Intrinsics != null
                        ? BuildProjection(frame.Intrinsics, cameraParams)
                        : Matrix4x4.identity,
                    displayMatrix: Matrix4x4.identity,
                    trackingState: TrackingState.Tracking,
                    nativePtr: IntPtr.Zero,
                    properties: XRCameraFrameProperties.Timestamp
                              | XRCameraFrameProperties.ProjectionMatrix
                              | XRCameraFrameProperties.AverageBrightness
                              | XRCameraFrameProperties.AverageColorTemperature
                );
                return true;
            }

            // カメラテクスチャ
            public override bool TryAcquireLatestCpuImage(out XRCpuImage cpuImage)
            {
                cpuImage = default;
                return false;   // CPU Image は将来対応
            }

            public override Material cameraMaterial => _cameraMaterial;

            public override bool permissionGranted => true;

            public override void GetMaterialKeywords(out List<string> enabledKeywords, out List<string> disabledKeywords)
            {
                enabledKeywords  = null;
                disabledKeywords = null;
            }

            // 投影行列生成
            private static Matrix4x4 BuildProjection(CameraIntrinsics intr, XRCameraParams p)
            {
                float w    = intr.W;
                float h    = intr.H;
                float near = p.zNear;
                float far  = p.zFar;

                var m = Matrix4x4.zero;
                m[0, 0] = 2f * intr.Fx / w;
                m[1, 1] = 2f * intr.Fy / h;
                m[0, 2] = 1f - 2f * intr.Ppx / w;
                m[1, 2] = 2f * intr.Ppy / h - 1f;
                m[2, 2] = -(far + near) / (far - near);
                m[2, 3] = -2f * far * near / (far - near);
                m[3, 2] = -1f;
                return m;
            }

            public override void Destroy()
            {
                if (_cameraMaterial != null)
                    UnityEngine.Object.Destroy(_cameraMaterial);
            }
        }
    }

    // ═════════════════════════════════════════════════════════════
    // Plane Subsystem
    // ═════════════════════════════════════════════════════════════

    public sealed class EditorPreviewPlaneSubsystem : XRPlaneSubsystem
    {
        public const string k_SubsystemId = "AREditorPreview-Plane";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void Register()
        {
            var info = new XRPlaneSubsystemDescriptor.Cinfo
            {
                id                              = k_SubsystemId,
                providerType                    = typeof(PlaneProvider),
                subsystemTypeOverride           = typeof(EditorPreviewPlaneSubsystem),
                supportsHorizontalPlaneDetection = true,
                supportsVerticalPlaneDetection   = true,
                supportsArbitraryPlaneDetection  = false,
                supportsBoundaryVertices         = true,
            };
            XRPlaneSubsystemDescriptor.Create(info);
        }

        class PlaneProvider : Provider
        {
            // ARPlaneUpdate の差分を蓄積する辞書
            private readonly Dictionary<TrackableId, BoundedPlane> _planes = new();
            private readonly List<BoundedPlane> _added   = new();
            private readonly List<BoundedPlane> _updated = new();
            private readonly List<TrackableId>  _removed = new();

            private ARPlaneUpdate _lastProcessed;

            public override void GetBoundary(
                TrackableId trackableId,
                Allocator allocator,
                ref NativeArray<Vector2> boundary)
            {
                // boundary は BoundedPlane に既に格納されているので ここでは返さない
                // (AR Foundation が BoundedPlane.boundary を使う)
            }

            public override TrackableChanges<BoundedPlane> GetChanges(
                BoundedPlane defaultPlane, Allocator allocator)
            {
                _added.Clear();
                _updated.Clear();
                _removed.Clear();

                var mgr    = AREditorPreviewManager.Instance;
                var update = mgr?.LatestPlanes;

                if (update == null || ReferenceEquals(update, _lastProcessed))
                    return TrackableChanges<BoundedPlane>.Create(
                        _added, _updated, _removed, allocator);

                _lastProcessed = update;

                foreach (var plane in update.Planes)
                {
                    var id = ParseTrackableId(plane.Id);
                    var bp = ConvertPlane(plane);

                    switch (plane.Event)
                    {
                        case TrackingEventType.TrackingEventAdded:
                            _planes[id] = bp;
                            _added.Add(bp);
                            break;

                        case TrackingEventType.TrackingEventUpdated:
                            _planes[id] = bp;
                            _updated.Add(bp);
                            break;

                        case TrackingEventType.TrackingEventRemoved:
                            _planes.Remove(id);
                            _removed.Add(id);
                            break;
                    }
                }

                return TrackableChanges<BoundedPlane>.Create(
                    _added, _updated, _removed, allocator);
            }

            // ─── 変換ユーティリティ ──────────────────────────────

            private static TrackableId ParseTrackableId(string guid)
            {
                // GUID 文字列 → TrackableId (128bit = 2×ulong)
                if (!System.Guid.TryParse(guid, out var g)) return TrackableId.invalidId;
                var bytes = g.ToByteArray();
                var lo = BitConverter.ToUInt64(bytes, 0);
                var hi = BitConverter.ToUInt64(bytes, 8);
                return new TrackableId(lo, hi);
            }

            private static BoundedPlane ConvertPlane(PlaneData p)
            {
                var center   = new Vector3(p.Center.X, p.Center.Y, p.Center.Z);
                var rotation = new Quaternion(p.Rotation.X, p.Rotation.Y, p.Rotation.Z, p.Rotation.W);
                var pose     = new Pose(center, rotation);
                var extents  = new Vector2(p.Extents.X, p.Extents.Y);

                var alignment = p.Alignment switch
                {
                    PlaneAlignment.PlaneAlignmentHorizontalUp   => PlaneAlignment.HorizontalUp,
                    PlaneAlignment.PlaneAlignmentHorizontalDown => PlaneAlignment.HorizontalDown,
                    PlaneAlignment.PlaneAlignmentVertical       => PlaneAlignment.Vertical,
                    _ => PlaneAlignment.NotAxisAligned,
                };

                // boundary_xz (interleaved float[]) → Vector2[]
                var bxz = p.BoundaryXz;
                var boundary = new NativeArray<Vector2>(bxz.Count / 2, Allocator.Temp);
                for (int i = 0; i < boundary.Length; i++)
                    boundary[i] = new Vector2(bxz[i * 2], bxz[i * 2 + 1]);

                // subsumedById
                TrackableId subsumedId = TrackableId.invalidId;
                if (!string.IsNullOrEmpty(p.SubsumedById))
                    subsumedId = ParseTrackableId(p.SubsumedById);

                var bp = new BoundedPlane(
                    trackableId: ParseTrackableId(p.Id),
                    subsumedById: subsumedId,
                    pose: pose,
                    center: Vector2.zero,
                    size: extents,
                    alignment: alignment,
                    trackingState: TrackingState.Tracking,
                    nativePtr: IntPtr.Zero,
                    classification: PlaneClassification.None
                );
                boundary.Dispose();
                return bp;
            }
        }
    }
}
