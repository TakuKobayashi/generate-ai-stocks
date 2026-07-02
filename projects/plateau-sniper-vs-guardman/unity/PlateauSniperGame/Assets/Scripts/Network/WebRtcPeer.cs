// =============================================================
//  WebRtcPeer.cs  (Unity 6 / com.unity.webrtc)
//  1ピアとの WebRTC DataChannel 接続を管理
//  ・unreliable + unordered = UDP 投げっぱなし
//  ・MessagePack バイナリを DataChannel で送受信
//  ・ICE/SDP は SignalingClient (PartyKit) 経由で交換
// =============================================================

using System;
using System.Collections;
using System.Collections.Generic;
using Unity.WebRTC;
using UnityEngine;

namespace PlateauSniper.Network
{
    public class WebRtcPeer : IDisposable
    {
        // ─── Public ────────────────────────────────────────────
        public string  PeerId     { get; }
        public bool    IsReady    => _dc?.ReadyState == RTCDataChannelState.Open;

        public event Action<byte[], string>? OnMessage; // (data, peerId)
        public event Action<string>?         OnClosed;  // peerId
        public event Action<string, string>? OnIceCandidate; // (peerId, candidateJson)
        public event Action<string, string>? OnLocalDescription; // (peerId, type+sdp JSON)

        // Public STUN サーバー
        private static readonly RTCIceServer[] IceServers = new[]
        {
            new RTCIceServer { urls = new[] { "stun:stun.l.google.com:19302"  } },
            new RTCIceServer { urls = new[] { "stun:stun1.l.google.com:19302" } },
            new RTCIceServer { urls = new[] { "stun:stun.mozilla.org"         } },
        };

        private static readonly RTCDataChannelInit DcInit = new()
        {
            ordered        = false,  // 順序保証なし
            maxRetransmits = 0,      // 再送なし = UDP 投げっぱなし
        };

        // ─── 内部 ─────────────────────────────────────────────
        private RTCPeerConnection _pc;
        private RTCDataChannel?   _dc;
        private readonly Queue<byte[]> _pendingQueue = new();

        public WebRtcPeer(string peerId)
        {
            PeerId = peerId;

            var config = new RTCConfiguration { iceServers = IceServers };
            _pc = new RTCPeerConnection(ref config);

            _pc.OnIceCandidate = (candidate) =>
            {
                var json = Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    candidate         = candidate.Candidate,
                    sdpMid            = candidate.SdpMid,
                    sdpMLineIndex     = candidate.SdpMLineIndex,
                });
                OnIceCandidate?.Invoke(PeerId, json);
            };

            _pc.OnIceConnectionChange = (state) =>
            {
                Debug.Log($"[WebRTC] {PeerId} ICE: {state}");
                if (state == RTCIceConnectionState.Failed ||
                    state == RTCIceConnectionState.Closed)
                    OnClosed?.Invoke(PeerId);
            };

            // Answer 側: ondatachannel で DataChannel を受け取る
            _pc.OnDataChannel = (dc) =>
            {
                if (dc.Label == "position")
                {
                    _dc = dc;
                    SetupDataChannel(_dc);
                }
            };
        }

        // ─── Offer 送信側 (後から入った人が offer する) ────────
        public IEnumerator CreateOfferCoroutine()
        {
            // DataChannel はオファー側が作成
            _dc = _pc.CreateDataChannel("position", DcInit);
            SetupDataChannel(_dc);

            var op = _pc.CreateOffer();
            yield return op;
            if (op.IsError) { Debug.LogError($"[WebRTC] CreateOffer: {op.Error}"); yield break; }

            var desc = op.Desc;
            var setOp = _pc.SetLocalDescription(ref desc);
            yield return setOp;
            if (setOp.IsError) { Debug.LogError($"[WebRTC] SetLocalDesc: {setOp.Error}"); yield break; }

            var json = Newtonsoft.Json.JsonConvert.SerializeObject(new { type = "offer", sdp = desc.sdp });
            OnLocalDescription?.Invoke(PeerId, json);
        }

        // ─── Answer 側 ─────────────────────────────────────────
        public IEnumerator HandleOfferCoroutine(string sdp)
        {
            var desc = new RTCSessionDescription { type = RTCSdpType.Offer, sdp = sdp };
            var setOp = _pc.SetRemoteDescription(ref desc);
            yield return setOp;
            if (setOp.IsError) { Debug.LogError($"[WebRTC] SetRemoteDesc(offer): {setOp.Error}"); yield break; }

            var ansOp = _pc.CreateAnswer();
            yield return ansOp;
            if (ansOp.IsError) { Debug.LogError($"[WebRTC] CreateAnswer: {ansOp.Error}"); yield break; }

            var ansDesc = ansOp.Desc;
            var setAnsOp = _pc.SetLocalDescription(ref ansDesc);
            yield return setAnsOp;
            if (setAnsOp.IsError) { Debug.LogError($"[WebRTC] SetLocalDesc(answer): {setAnsOp.Error}"); yield break; }

            var json = Newtonsoft.Json.JsonConvert.SerializeObject(new { type = "answer", sdp = ansDesc.sdp });
            OnLocalDescription?.Invoke(PeerId, json);
        }

        public IEnumerator HandleAnswerCoroutine(string sdp)
        {
            var desc = new RTCSessionDescription { type = RTCSdpType.Answer, sdp = sdp };
            var op   = _pc.SetRemoteDescription(ref desc);
            yield return op;
            if (op.IsError) Debug.LogError($"[WebRTC] SetRemoteDesc(answer): {op.Error}");
        }

        public void AddIceCandidate(string candidateJson)
        {
            try
            {
                dynamic obj = Newtonsoft.Json.JsonConvert.DeserializeObject(candidateJson)!;
                var init = new RTCIceCandidateInit
                {
                    candidate     = (string)obj.candidate,
                    sdpMid        = (string?)obj.sdpMid,
                    sdpMLineIndex = (int?)obj.sdpMLineIndex,
                };
                _pc.AddIceCandidate(new RTCIceCandidate(init));
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[WebRTC] AddIceCandidate parse: {e.Message}");
            }
        }

        // ─── 送信 ──────────────────────────────────────────────
        public void Send(byte[] data)
        {
            if (!IsReady)
            {
                // 未開通時は最新状態だけキープ (位置データは古いものを捨てる)
                _pendingQueue.Clear();
                _pendingQueue.Enqueue(data);
                return;
            }
            try
            {
                _dc!.Send(data);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[WebRTC] Send: {e.Message}");
            }
        }

        // ─── DataChannel セットアップ ─────────────────────────
        private void SetupDataChannel(RTCDataChannel dc)
        {
            dc.OnOpen = () =>
            {
                Debug.Log($"[WebRTC] DC open: {PeerId}");
                // 保留データを送信
                while (_pendingQueue.TryDequeue(out var buf))
                {
                    try { dc.Send(buf); } catch { /* ignore */ }
                }
            };

            dc.OnClose   = () => OnClosed?.Invoke(PeerId);
            dc.OnError   = (e) => Debug.LogWarning($"[WebRTC] DC error {PeerId}: {e}");
            dc.OnMessage = (bytes) => OnMessage?.Invoke(bytes, PeerId);
        }

        // ─── Dispose ──────────────────────────────────────────
        public void Dispose()
        {
            _dc?.Close();
            _pc.Close();
            _pc.Dispose();
        }
    }
}
