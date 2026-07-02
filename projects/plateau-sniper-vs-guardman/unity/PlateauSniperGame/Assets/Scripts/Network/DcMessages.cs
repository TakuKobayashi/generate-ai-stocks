// =============================================================
//  DcMessages.cs
//  WebRTC DataChannel (unreliable/unordered) ペイロード型
//  packages/shared/src/index.ts の DC* 型と 1:1 対応
//
//  MessagePack-CSharp (NuGet) でシリアライズ/デシリアライズ
//  配列フォーマット使用 → 最小バイト数
// =============================================================

using MessagePack;

namespace PlateauSniper.Network
{
    // ─── メッセージ種別 (先頭 1 バイト) ──────────────────────
    public static class DcType
    {
        public const byte SniperState    = 0x01;
        public const byte BodyguardState = 0x02;
        public const byte SniperFired    = 0x03;
        public const byte CoverOrder     = 0x04;
        public const byte DispatchOrder  = 0x05;
        public const byte GameEvent      = 0x06;
    }

    // ─── ペイロード型 ─────────────────────────────────────────

    /// <summary>
    /// [0x01, px, py, pz, qx, qy, qz, qw, mode, tp]
    /// スナイパーの位置・姿勢・モード (20fps で投げっぱなし)
    /// </summary>
    [MessagePackObject]
    public class DcSniperState
    {
        [Key(0)] public byte   T    { get; set; } = DcType.SniperState;
        [Key(1)] public float  Px   { get; set; }
        [Key(2)] public float  Py   { get; set; }
        [Key(3)] public float  Pz   { get; set; }
        [Key(4)] public float  Qx   { get; set; }
        [Key(5)] public float  Qy   { get; set; }
        [Key(6)] public float  Qz   { get; set; }
        [Key(7)] public float  Qw   { get; set; }
        /// <summary>"walking" | "transitioning" | "aiming"</summary>
        [Key(8)] public string Mode { get; set; } = "walking";
        /// <summary>遷移進捗 0.0〜1.0</summary>
        [Key(9)] public float  Tp   { get; set; }

        public UnityEngine.Vector3    Position =>
            new(Px, Py, Pz);
        public UnityEngine.Quaternion Rotation =>
            new(Qx, Qy, Qz, Qw);

        public static DcSniperState From(
            UnityEngine.Vector3    pos,
            UnityEngine.Quaternion rot,
            string mode, float tp) => new()
        {
            Px = pos.x, Py = pos.y, Pz = pos.z,
            Qx = rot.x, Qy = rot.y, Qz = rot.z, Qw = rot.w,
            Mode = mode, Tp = tp,
        };
    }

    /// <summary>
    /// [0x02, id, px, py, pz, qx, qy, qz, qw, sp]
    /// ボディガードの位置・姿勢 (20fps)
    /// </summary>
    [MessagePackObject]
    public class DcBodyguardState
    {
        [Key(0)]  public byte   T    { get; set; } = DcType.BodyguardState;
        [Key(1)]  public string Id   { get; set; } = "";
        [Key(2)]  public float  Px   { get; set; }
        [Key(3)]  public float  Py   { get; set; }
        [Key(4)]  public float  Pz   { get; set; }
        [Key(5)]  public float  Qx   { get; set; }
        [Key(6)]  public float  Qy   { get; set; }
        [Key(7)]  public float  Qz   { get; set; }
        [Key(8)]  public float  Qw   { get; set; }
        [Key(9)]  public bool   Sp   { get; set; }

        public UnityEngine.Vector3    Position =>
            new(Px, Py, Pz);
        public UnityEngine.Quaternion Rotation =>
            new(Qx, Qy, Qz, Qw);

        public static DcBodyguardState From(
            string id,
            UnityEngine.Vector3    pos,
            UnityEngine.Quaternion rot,
            bool sprinting) => new()
        {
            Id = id,
            Px = pos.x, Py = pos.y, Pz = pos.z,
            Qx = rot.x, Qy = rot.y, Qz = rot.z, Qw = rot.w,
            Sp = sprinting,
        };
    }

    /// <summary>
    /// [0x03, ox, oy, oz, dx, dy, dz, hit, hx?, hy?, hz?, tag?]
    /// 射撃イベント
    /// </summary>
    [MessagePackObject]
    public class DcSniperFired
    {
        [Key(0)]  public byte    T    { get; set; } = DcType.SniperFired;
        [Key(1)]  public float   Ox   { get; set; }
        [Key(2)]  public float   Oy   { get; set; }
        [Key(3)]  public float   Oz   { get; set; }
        [Key(4)]  public float   Dx   { get; set; }
        [Key(5)]  public float   Dy   { get; set; }
        [Key(6)]  public float   Dz   { get; set; }
        [Key(7)]  public bool    Hit  { get; set; }
        [Key(8)]  public float?  Hx   { get; set; }
        [Key(9)]  public float?  Hy   { get; set; }
        [Key(10)] public float?  Hz   { get; set; }
        [Key(11)] public string? Tag  { get; set; }

        public UnityEngine.Vector3 Origin    => new(Ox, Oy, Oz);
        public UnityEngine.Vector3 Direction => new(Dx, Dy, Dz);
        public UnityEngine.Vector3? HitPoint =>
            Hx.HasValue ? new UnityEngine.Vector3(Hx.Value, Hy!.Value, Hz!.Value) : null;
    }

    /// <summary>[0x04, bgId, coverPointName]</summary>
    [MessagePackObject]
    public class DcCoverOrder
    {
        [Key(0)] public byte   T    { get; set; } = DcType.CoverOrder;
        [Key(1)] public string BgId { get; set; } = "";
        [Key(2)] public string Cp   { get; set; } = "";
    }

    /// <summary>[0x05, bgId, guardId]</summary>
    [MessagePackObject]
    public class DcDispatchOrder
    {
        [Key(0)] public byte   T    { get; set; } = DcType.DispatchOrder;
        [Key(1)] public string BgId { get; set; } = "";
        [Key(2)] public string Gid  { get; set; } = "";
    }

    /// <summary>[0x06, event, data?]</summary>
    [MessagePackObject]
    public class DcGameEvent
    {
        [Key(0)] public byte   T  { get; set; } = DcType.GameEvent;
        [Key(1)] public string Ev { get; set; } = "";

        // ゲームイベント定数
        public const string TargetEliminated = "target_eliminated";
        public const string SniperCaptured   = "sniper_captured";
        public const string ShotMissed       = "shot_missed";
        public const string SniperDetected   = "sniper_detected";
    }

    // ─── コーデック ───────────────────────────────────────────

    public static class DcCodec
    {
        /// <summary>ペイロードを MessagePack バイト列にエンコード</summary>
        public static byte[] Encode<T>(T payload) =>
            MessagePackSerializer.Serialize(payload);

        /// <summary>
        /// バイト列の先頭 1 バイトで型を判別してデコード
        /// 戻り値: DcSniperState | DcBodyguardState | DcSniperFired |
        ///         DcCoverOrder | DcDispatchOrder | DcGameEvent | null
        /// </summary>
        public static object? Decode(byte[] data)
        {
            if (data == null || data.Length == 0) return null;

            // MessagePack 配列の先頭要素を取り出す (index 0 = fixarray + first element)
            // MessagePackSerializer.Deserialize を使って先に配列として取得する
            var arr = MessagePackSerializer.Deserialize<MessagePack.MessagePackObject[]>(data);
            if (arr == null || arr.Length == 0) return null;

            byte t = arr[0].AsByte();

            return t switch
            {
                DcType.SniperState    => MessagePackSerializer.Deserialize<DcSniperState>(data),
                DcType.BodyguardState => MessagePackSerializer.Deserialize<DcBodyguardState>(data),
                DcType.SniperFired    => MessagePackSerializer.Deserialize<DcSniperFired>(data),
                DcType.CoverOrder     => MessagePackSerializer.Deserialize<DcCoverOrder>(data),
                DcType.DispatchOrder  => MessagePackSerializer.Deserialize<DcDispatchOrder>(data),
                DcType.GameEvent      => MessagePackSerializer.Deserialize<DcGameEvent>(data),
                _                     => null,
            };
        }
    }
}
