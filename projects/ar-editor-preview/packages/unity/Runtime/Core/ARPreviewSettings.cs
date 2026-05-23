// packages/unity/Runtime/Core/ARPreviewSettings.cs

using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

namespace AREditorPreview.Core
{
    [CreateAssetMenu(
        fileName = "ARPreviewSettings",
        menuName  = "AR Editor Preview/Settings",
        order     = 0)]
    public sealed class ARPreviewSettings : ScriptableObject
    {
        private const string k_ResourcePath = "ARPreviewSettings";

        // ── LiveKit ──────────────────────────────────────────────
        [Header("LiveKit 接続")]
        [Tooltip("LiveKit サーバーの WebSocket URL\n例: ws://192.168.1.100:7880")]
        [SerializeField] private string _serverUrl  = "ws://localhost:7880";

        [Tooltip("参加するルーム名")]
        [SerializeField] private string _roomName   = "ar-preview";

        [Tooltip("LiveKit API Key (docker-compose と合わせること)")]
        [SerializeField] private string _apiKey     = "devkey";

        [Tooltip("LiveKit API Secret")]
        [SerializeField] private string _apiSecret  = "secret";

        // ── 映像 ─────────────────────────────────────────────────
        [Header("映像受信")]
        [SerializeField] private int _videoWidth  = 1280;
        [SerializeField] private int _videoHeight = 720;

        // ── 動作 ─────────────────────────────────────────────────
        [Header("動作設定")]
        [Tooltip("Play 開始時に自動接続する")]
        [SerializeField] private bool  _autoConnect          = true;

        [Tooltip("切断時に自動再接続する")]
        [SerializeField] private bool  _autoReconnect        = true;

        [Tooltip("再接続間隔 (秒)")]
        [SerializeField] private float _reconnectIntervalSec = 3f;

        [Tooltip("受信データのデバッグログを出力する")]
        [SerializeField] private bool  _verboseLog           = false;

        // ── プロパティ ───────────────────────────────────────────
        public string ServerUrl           => _serverUrl;
        public string RoomName            => _roomName;
        public string ApiKey              => _apiKey;
        public string ApiSecret           => _apiSecret;
        public int    VideoWidth          => _videoWidth;
        public int    VideoHeight         => _videoHeight;
        public bool   AutoConnect         => _autoConnect;
        public bool   AutoReconnect       => _autoReconnect;
        public float  ReconnectIntervalSec => _reconnectIntervalSec;
        public bool   VerboseLog          => _verboseLog;

        // ── ロード ───────────────────────────────────────────────

        /// <summary>
        /// Resources から設定をロード。存在しなければデフォルト値で新規作成 (Editor のみ)。
        /// </summary>
        public static ARPreviewSettings Load()
        {
            var settings = Resources.Load<ARPreviewSettings>(k_ResourcePath);

#if UNITY_EDITOR
            if (settings == null)
            {
                settings = CreateInstance<ARPreviewSettings>();
                const string dir  = "Assets/Resources";
                if (!System.IO.Directory.Exists(dir))
                    System.IO.Directory.CreateDirectory(dir);

                AssetDatabase.CreateAsset(settings, $"{dir}/{k_ResourcePath}.asset");
                AssetDatabase.SaveAssets();
                Debug.Log($"[ARPreview] Created default settings at {dir}/{k_ResourcePath}.asset");
            }
#endif
            return settings ?? CreateInstance<ARPreviewSettings>();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // LiveKit JWT トークン生成ヘルパー
    // ─────────────────────────────────────────────────────────────

    public static class LiveKitTokenHelper
    {
        public static string GenerateEditorToken(ARPreviewSettings s)
            => GenerateToken(s.ServerUrl, s.RoomName, "unity-editor", s.ApiKey, s.ApiSecret,
                             canPublish: false, canSubscribe: true);

        public static string GenerateDeviceToken(ARPreviewSettings s, string deviceIdentity)
            => GenerateToken(s.ServerUrl, s.RoomName, deviceIdentity, s.ApiKey, s.ApiSecret,
                             canPublish: true, canSubscribe: false);

        private static string GenerateToken(
            string serverUrl, string room, string identity,
            string apiKey, string apiSecret,
            bool canPublish, bool canSubscribe)
        {
            var now = System.DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            // ペイロードを手動で JSON 文字列として組み立て
            // (JsonUtility は入れ子の bool に弱いため)
            var payload = $@"{{
  ""iss"":""{apiKey}"",
  ""sub"":""{identity}"",
  ""iat"":{now},
  ""exp"":{now + 3600},
  ""nbf"":{now},
  ""jti"":""{System.Guid.NewGuid():N}"",
  ""video"":{{
    ""room"":""{room}"",
    ""roomJoin"":true,
    ""canPublish"":{(canPublish ? "true" : "false")},
    ""canSubscribe"":{(canSubscribe ? "true" : "false")},
    ""canPublishData"":false
  }}
}}";
            return JwtHS256.Encode(payload, apiSecret);
        }
    }

    internal static class JwtHS256
    {
        public static string Encode(string jsonPayload, string secret)
        {
            var headerJson  = @"{""alg"":""HS256"",""typ"":""JWT""}";
            var header      = B64U(System.Text.Encoding.UTF8.GetBytes(headerJson));
            var body        = B64U(System.Text.Encoding.UTF8.GetBytes(jsonPayload));
            var sigInput    = System.Text.Encoding.UTF8.GetBytes($"{header}.{body}");
            var key         = System.Text.Encoding.UTF8.GetBytes(secret);
            using var hmac  = new System.Security.Cryptography.HMACSHA256(key);
            var sig         = B64U(hmac.ComputeHash(sigInput));
            return $"{header}.{body}.{sig}";
        }

        private static string B64U(byte[] data)
            => System.Convert.ToBase64String(data)
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
