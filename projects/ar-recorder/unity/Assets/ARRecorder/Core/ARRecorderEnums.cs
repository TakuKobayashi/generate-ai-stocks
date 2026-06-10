// Assets/ARRecorder/Core/ARRecorderEnums.cs
namespace ARRecorder.Core
{
    /// <summary>AR画面のキャプチャモード</summary>
    public enum ARCaptureMode
    {
        /// <summary>カメラ映像 + AR オーバーレイ 両方</summary>
        FullARView,
        /// <summary>カメラ映像のみ（AR 要素を非表示）</summary>
        CameraOnly,
        /// <summary>AR 要素のみ（背景透明）</summary>
        ARElementsOnly
    }

    /// <summary>動画・配信時のオーディオソース</summary>
    public enum AudioCaptureMode
    {
        /// <summary>音声なし</summary>
        None,
        /// <summary>マイク入力</summary>
        Microphone,
        /// <summary>アプリ内サウンド</summary>
        AppAudio
    }

    /// <summary>ストリーミング / 配信の状態</summary>
    public enum StreamingState
    {
        Idle,
        Initializing,
        Streaming,
        Paused,
        Error
    }
}
