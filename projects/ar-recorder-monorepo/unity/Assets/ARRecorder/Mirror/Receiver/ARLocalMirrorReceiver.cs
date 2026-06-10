// Assets/ARRecorder/Mirror/Receiver/ARLocalMirrorReceiver.cs
using System;
using System.Net.Sockets;
using System.Threading;
using UnityEngine;
using UnityEngine.UI;
using ARRecorder.Core;

namespace ARRecorder.Mirror
{
    /// <summary>
    /// ARLocalMirrorSender が発信する TCP JPEG ストリームを受信して RawImage に表示する受信側コンポーネント。
    /// </summary>
    public class ARLocalMirrorReceiver : MonoBehaviour
    {
        [Header("Connection")]
        [SerializeField] private string serverAddress = "192.168.1.100";
        [SerializeField] private int    serverPort    = 9000;

        [Header("Display")]
        [SerializeField] private RawImage displayImage;

        private TcpClient  tcpClient;
        private Thread     receiveThread;
        private bool       connected;
        private bool       receiving;

        // スレッド間通信
        private byte[]     latestFrame;
        private bool       hasNew;
        private readonly object frameLock = new object();

        private Texture2D  displayTex;

        public bool IsConnected => connected;

        public event Action         OnConnected;
        public event Action         OnDisconnected;
        public event Action<string> OnError;

        // ---- 公開 API ----

        public void SetServerAddress(string addr) => serverAddress = addr;
        public void SetServerPort(int port)       => serverPort    = port;

        public void Connect()
        {
            if (connected) return;
            try
            {
                tcpClient = new TcpClient();
                tcpClient.Connect(serverAddress, serverPort);
                tcpClient.ReceiveBufferSize = 256 * 1024;

                connected  = true;
                receiving  = true;

                receiveThread = new Thread(ReceiveLoop) { IsBackground = true };
                receiveThread.Start();

                OnConnected?.Invoke();
                Debug.Log($"[MirrorReceiver] Connected → {serverAddress}:{serverPort}");
            }
            catch (Exception e)
            {
                OnError?.Invoke(e.Message);
                Debug.LogError($"[MirrorReceiver] Connect: {e}");
            }
        }

        public void Disconnect()
        {
            if (!connected) return;
            receiving  = false;
            connected  = false;
            try { tcpClient?.Close(); } catch { /* ignored */ }
            receiveThread?.Join(1000);
            OnDisconnected?.Invoke();
            Debug.Log("[MirrorReceiver] Disconnected");
        }

        // ---- 受信スレッド ----

        private void ReceiveLoop()
        {
            var stream = tcpClient.GetStream();
            var sizeBuf = new byte[4];

            while (receiving)
            {
                try
                {
                    // ヘッダー4バイト読み込み
                    ReadExact(stream, sizeBuf, 4);
                    int size = BitConverter.ToInt32(sizeBuf, 0);

                    if (size <= 0 || size > 10 * 1024 * 1024)
                    { Debug.LogWarning($"[MirrorReceiver] Invalid frame size: {size}"); continue; }

                    var data = new byte[size];
                    ReadExact(stream, data, size);

                    lock (frameLock) { latestFrame = data; hasNew = true; }
                }
                catch (Exception e)
                {
                    if (receiving)
                    {
                        Debug.LogError($"[MirrorReceiver] ReceiveLoop: {e.Message}");
                        UnityMainThreadDispatcher.Instance().Enqueue(() =>
                        {
                            OnError?.Invoke(e.Message);
                            Disconnect();
                        });
                    }
                    break;
                }
            }
        }

        private static void ReadExact(NetworkStream stream, byte[] buf, int count)
        {
            int read = 0;
            while (read < count)
            {
                int n = stream.Read(buf, read, count - read);
                if (n <= 0) throw new Exception("Connection closed");
                read += n;
            }
        }

        // ---- Unity メインスレッドで表示更新 ----

        private void Update()
        {
            lock (frameLock)
            {
                if (!hasNew || latestFrame == null) return;
                hasNew = false;
                ApplyFrame(latestFrame);
            }
        }

        private void ApplyFrame(byte[] jpeg)
        {
            if (displayImage == null) return;
            if (displayTex == null) displayTex = new Texture2D(2, 2);
            displayTex.LoadImage(jpeg);
            displayImage.texture = displayTex;
        }

        private void OnDestroy()
        {
            Disconnect();
            if (displayTex != null) Destroy(displayTex);
        }

        private void OnApplicationQuit() => Disconnect();
    }
}
