// packages/unity/Tests/Runtime/TransportProtocolTests.cs
// IARTransport / Protobuf デシリアライズのユニットテスト。
// Unity Test Runner (Play Mode) で実行する。

using System;
using System.Collections;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using Google.Protobuf;
using AREditorPreview.Proto;
using AREditorPreview.Transport;

namespace AREditorPreview.Tests.Runtime
{
    // ─────────────────────────────────────────────────────────────
    // Protobuf Envelope エンコード/デコードのラウンドトリップテスト
    // ─────────────────────────────────────────────────────────────

    public class EnvelopeRoundTripTests
    {
        [Test]
        public void ARFrame_RoundTrip()
        {
            var original = new Envelope
            {
                Frame = new ARFrame
                {
                    TimestampMs  = 123456789L,
                    FrameNumber  = 42UL,
                    Pose = new CameraPose
                    {
                        Position = new Vec3 { X = 1f, Y = 2f, Z = 3f },
                        Rotation = new Quaternion { X = 0f, Y = 0f, Z = 0f, W = 1f },
                    },
                    Intrinsics = new CameraIntrinsics
                    {
                        Fx = 600f, Fy = 600f, Ppx = 320f, Ppy = 240f,
                        W  = 640,  H  = 480,
                    },
                    Light = new LightEstimate
                    {
                        AverageIntensity  = 500f,
                        ColorTemperature  = 6500f,
                    },
                }
            };

            // シリアライズ → デシリアライズ
            var bytes     = original.ToByteArray();
            var decoded   = Envelope.Parser.ParseFrom(bytes);

            Assert.AreEqual(Envelope.PayloadOneofCase.Frame, decoded.PayloadCase);
            Assert.AreEqual(original.Frame.TimestampMs,      decoded.Frame.TimestampMs);
            Assert.AreEqual(original.Frame.FrameNumber,      decoded.Frame.FrameNumber);
            Assert.AreEqual(1f, decoded.Frame.Pose.Position.X, 0.0001f);
            Assert.AreEqual(2f, decoded.Frame.Pose.Position.Y, 0.0001f);
            Assert.AreEqual(3f, decoded.Frame.Pose.Position.Z, 0.0001f);
            Assert.AreEqual(600f, decoded.Frame.Intrinsics.Fx, 0.0001f);
            Assert.AreEqual(500f, decoded.Frame.Light.AverageIntensity, 0.0001f);
        }

        [Test]
        public void ARPlaneUpdate_RoundTrip()
        {
            var planeId = Guid.NewGuid().ToString();
            var original = new Envelope
            {
                Planes = new ARPlaneUpdate
                {
                    TimestampMs = 999L,
                    Planes =
                    {
                        new PlaneData
                        {
                            Id        = planeId,
                            Event     = TrackingEventType.TrackingEventAdded,
                            Alignment = PlaneAlignment.PlaneAlignmentHorizontalUp,
                            Center    = new Vec3 { X = 0f, Y = -0.5f, Z = 0f },
                            Rotation  = new Quaternion { X = 0f, Y = 0f, Z = 0f, W = 1f },
                            Extents   = new Vec2 { X = 1.5f, Y = 1.0f },
                        }
                    }
                }
            };

            var bytes   = original.ToByteArray();
            var decoded = Envelope.Parser.ParseFrom(bytes);

            Assert.AreEqual(Envelope.PayloadOneofCase.Planes,  decoded.PayloadCase);
            Assert.AreEqual(1,                                  decoded.Planes.Planes.Count);
            Assert.AreEqual(planeId,                           decoded.Planes.Planes[0].Id);
            Assert.AreEqual(TrackingEventType.TrackingEventAdded, decoded.Planes.Planes[0].Event);
            Assert.AreEqual(-0.5f, decoded.Planes.Planes[0].Center.Y, 0.0001f);
        }

        [Test]
        public void SessionState_RoundTrip()
        {
            var original = new Envelope
            {
                Session = new SessionState
                {
                    TimestampMs   = 111L,
                    Status        = SessionStatus.SessionStatusTracking,
                    Platform      = Platform.PlatformAndroid,
                    DeviceModel   = "Pixel 8 Pro",
                    OsVersion     = "14",
                    ArSdkVersion  = "1.43.0",
                    Features      = { "planes", "light_estimate" },
                }
            };

            var bytes   = original.ToByteArray();
            var decoded = Envelope.Parser.ParseFrom(bytes);

            Assert.AreEqual(Envelope.PayloadOneofCase.Session, decoded.PayloadCase);
            Assert.AreEqual(Platform.PlatformAndroid,          decoded.Session.Platform);
            Assert.AreEqual("Pixel 8 Pro",                     decoded.Session.DeviceModel);
            Assert.AreEqual(2,                                 decoded.Session.Features.Count);
        }

        [Test]
        public void Ping_Pong_RoundTrip()
        {
            var ping = new Envelope { Ping = new Ping { TimestampMs = 12345L } };
            var pong = new Envelope { Pong = new Pong { PingTimestampMs = 12345L, PongTimestampMs = 12400L } };

            var pingDecoded = Envelope.Parser.ParseFrom(ping.ToByteArray());
            var pongDecoded = Envelope.Parser.ParseFrom(pong.ToByteArray());

            Assert.AreEqual(Envelope.PayloadOneofCase.Ping, pingDecoded.PayloadCase);
            Assert.AreEqual(12345L, pingDecoded.Ping.TimestampMs);
            Assert.AreEqual(Envelope.PayloadOneofCase.Pong, pongDecoded.PayloadCase);
            Assert.AreEqual(55L, pongDecoded.Pong.PongTimestampMs - pongDecoded.Pong.PingTimestampMs);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // MockTransport — IARTransport のテスト用実装
    // ─────────────────────────────────────────────────────────────

    public class MockARTransport : IARTransport
    {
        public TransportState State { get; private set; } = TransportState.Disconnected;
        public float          RttMs { get; private set; } = -1f;

        public event Action<TransportState> OnStateChanged;
        public event Action<string>         OnParticipantJoined;
        public event Action<string>         OnParticipantLeft;

        private readonly Queue<ReceivedEnvelope> _queue = new Queue<ReceivedEnvelope>();

        public System.Threading.Tasks.Task ConnectAsync(
            TransportConnectParams p,
            System.Threading.CancellationToken ct = default)
        {
            State = TransportState.Connected;
            OnStateChanged?.Invoke(State);
            return System.Threading.Tasks.Task.CompletedTask;
        }

        public System.Threading.Tasks.Task DisconnectAsync()
        {
            State = TransportState.Disconnected;
            OnStateChanged?.Invoke(State);
            return System.Threading.Tasks.Task.CompletedTask;
        }

        public int DequeueEnvelopes(Span<ReceivedEnvelope> buffer)
        {
            int count = 0;
            while (count < buffer.Length && _queue.Count > 0)
                buffer[count++] = _queue.Dequeue();
            return count;
        }

        public Texture GetLatestCameraTexture() => null;

        /// テスト用: エンベロープをキューに積む
        public void InjectEnvelope(Envelope env) =>
            _queue.Enqueue(new ReceivedEnvelope(env, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), "test-device"));

        public void Dispose() => _ = DisconnectAsync();
    }

    // ─────────────────────────────────────────────────────────────
    // MockTransport を使った Manager テスト
    // ─────────────────────────────────────────────────────────────

    public class AREditorPreviewManagerTests
    {
        private MockARTransport _transport;
        private ReceivedEnvelope[] _buffer;

        [SetUp]
        public void SetUp()
        {
            _transport = new MockARTransport();
            _buffer    = new ReceivedEnvelope[64];
        }

        [TearDown]
        public void TearDown()
        {
            _transport.Dispose();
        }

        [Test]
        public void Inject_Frame_Then_Dequeue_Returns_Frame()
        {
            var env = new Envelope
            {
                Frame = new ARFrame { TimestampMs = 55555L, FrameNumber = 1UL }
            };
            _transport.InjectEnvelope(env);

            var count   = _transport.DequeueEnvelopes(_buffer);
            Assert.AreEqual(1, count);
            Assert.AreEqual(Envelope.PayloadOneofCase.Frame, _buffer[0].Payload.PayloadCase);
            Assert.AreEqual(55555L, _buffer[0].Payload.Frame.TimestampMs);
        }

        [Test]
        public void Connect_Sets_State_Connected()
        {
            TransportState captured = TransportState.Disconnected;
            _transport.OnStateChanged += s => captured = s;

            _ = _transport.ConnectAsync(new TransportConnectParams
            {
                ServerUrl = "ws://localhost:7880",
                RoomName  = "test",
                Identity  = "editor",
                Token     = "token",
            });

            Assert.AreEqual(TransportState.Connected, captured);
        }

        [Test]
        public void Disconnect_Sets_State_Disconnected()
        {
            _ = _transport.ConnectAsync(new TransportConnectParams
            {
                ServerUrl = "ws://localhost:7880",
                RoomName  = "test",
                Identity  = "editor",
                Token     = "token",
            });

            TransportState captured = TransportState.Connected;
            _transport.OnStateChanged += s => captured = s;
            _ = _transport.DisconnectAsync();

            Assert.AreEqual(TransportState.Disconnected, captured);
        }
    }
}
