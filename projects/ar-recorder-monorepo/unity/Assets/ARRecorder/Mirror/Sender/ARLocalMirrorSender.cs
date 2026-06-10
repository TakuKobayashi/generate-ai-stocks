// Assets/ARRecorder/Mirror/Sender/ARLocalMirrorSender.cs
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using UnityEngine;
using ARRecorder.Core;

namespace ARRecorder.Mirror
{
    /// <summary>
    /// ローカルネットワーク上に TCP サーバーを立て、AR 画面を JPEG ストリームで
    /// 複数クライアントにブロードキャストする送信側コンポーネント。
    /// <para>プロトコル: [4 bytes frame-size LE][N bytes JPEG]</para>
    /// </summary>
    [RequireComponent(typeof(ARCaptureSystem))]
    public class ARLocalMirrorSender : MonoBehaviour
    {
        [Header("Server Settings")]
        [SerializeField] private int  port          = 9000;
        [SerializeField] private bool autoStart     = true;

        [Header("Stream Quality")]
        [SerializeField] private int frameRate   = 30;
        [SerializeField, Range(1, 100)]
        private int  jpegQuality = 75;
        [SerializeField] private int targetWidth  = 1280;
        [SerializeField] private int targetHeight = 720;

        private ARCaptureSystem captureSystem;
        private TcpListener     listener;
        private Thread          acceptThread;
        private bool            running;

        private readonly List<TcpClient> clients = new List<TcpClient>();
        private readonly object          clientLock = new object();

        public bool IsRunning          => running;
        public int  ClientCount        => clients.Count;
        public int  Port               => port;
        public string LocalIPAddress   => GetLocalIP();

        public event Action<string> OnClientConnected;
        public event Action<string> OnClientDisconnected;
        public event Action<string> OnError;

        // ----------------------------------------------------------------

        private void Awake() => captureSystem = GetComponent<ARCaptureSystem>();

        private void Start()
        {
            if (autoStart) StartServer();
        }

        // ---- 公開 API ----

        public void StartServer()
        {
            if (running) return;
            try
            {
                listener = new TcpListener(IPAddress.Any, port);
                listener.Start();
                running = true;

                acceptThread = new Thread(AcceptLoop) { IsBackground = true };
                acceptThread.Start();

                StartCoroutine(BroadcastLoop());
                Debug.Log($"[MirrorSender] Server started on {GetLocalIP()}:{port}");
            }
            catch (Exception e)
            {
                OnError?.Invoke(e.Message);
                Debug.LogError($"[MirrorSender] StartServer: {e}");
            }
        }

        public void StopServer()
        {
            if (!running) return;
            running = false;

            StopAllCoroutines();

            lock (clientLock)
            {
                foreach (var c in clients) c.Close();
                clients.Clear();
            }

            try { listener?.Stop(); } catch { /* ignored */ }

            acceptThread?.Join(1000);
            Debug.Log("[MirrorSender] Server stopped");
        }

        // ---- Accept スレッド ----

        private void AcceptLoop()
        {
            while (running)
            {
                try
                {
                    if (!listener.Pending()) { Thread.Sleep(50); continue; }

                    var client = listener.AcceptTcpClient();
                    client.SendBufferSize    = 256 * 1024;
                    client.NoDelay          = true;

                    lock (clientLock) { clients.Add(client); }

                    string addr = ((IPEndPoint)client.Client.RemoteEndPoint).Address.ToString();
                    Debug.Log($"[MirrorSender] Client connected: {addr}");
                    UnityMainThreadDispatcher.Instance().Enqueue(() => OnClientConnected?.Invoke(addr));
                }
                catch (Exception e)
                {
                    if (running) Debug.LogError($"[MirrorSender] AcceptLoop: {e.Message}");
                }
            }
        }

        // ---- ブロードキャストコルーチン ----

        private IEnumerator BroadcastLoop()
        {
            float interval = 1f / frameRate;
            while (running)
            {
                if (clients.Count > 0)
                {
                    captureSystem.CaptureFrame();
                    byte[] frame = EncodeJPEG(captureSystem.GetRenderTexture());
                    if (frame != null) SendToAll(frame);
                }
                yield return new WaitForSeconds(interval);
            }
        }

        private byte[] EncodeJPEG(RenderTexture rt)
        {
            try
            {
                var prev = RenderTexture.active;
                RenderTexture.active = rt;
                var tex = new Texture2D(targetWidth, targetHeight, TextureFormat.RGB24, false);
                tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
                tex.Apply();
                RenderTexture.active = prev;
                byte[] data = tex.EncodeToJPG(jpegQuality);
                Destroy(tex);
                return data;
            }
            catch (Exception e)
            {
                Debug.LogError($"[MirrorSender] EncodeJPEG: {e.Message}");
                return null;
            }
        }

        private void SendToAll(byte[] frameData)
        {
            byte[] header = BitConverter.GetBytes(frameData.Length);
            var dead = new List<TcpClient>();

            lock (clientLock)
            {
                foreach (var c in clients)
                {
                    try
                    {
                        if (!c.Connected) { dead.Add(c); continue; }
                        var s = c.GetStream();
                        s.Write(header,    0, 4);
                        s.Write(frameData, 0, frameData.Length);
                    }
                    catch { dead.Add(c); }
                }

                foreach (var c in dead)
                {
                    clients.Remove(c);
                    string addr = "unknown";
                    try { addr = ((IPEndPoint)c.Client.RemoteEndPoint).Address.ToString(); } catch { }
                    c.Close();
                    Debug.Log($"[MirrorSender] Client disconnected: {addr}");
                    UnityMainThreadDispatcher.Instance().Enqueue(() => OnClientDisconnected?.Invoke(addr));
                }
            }
        }

        // ---- ユーティリティ ----

        private static string GetLocalIP()
        {
            try
            {
                foreach (var ip in Dns.GetHostEntry(Dns.GetHostName()).AddressList)
                    if (ip.AddressFamily == AddressFamily.InterNetwork) return ip.ToString();
            }
            catch { }
            return "127.0.0.1";
        }

        private void OnDestroy()      => StopServer();
        private void OnApplicationQuit() => StopServer();
    }
}
