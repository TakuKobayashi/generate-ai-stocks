using System.Collections;
using PlateauSniper.Network;
using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// ゲーム全体の状態管理 (Unity 6 / ネットワーク対応版)
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("ルール設定")]
    [Tooltip("制限時間（秒）")] public float gameDuration = 180f;

    [Header("スポーン地点")]
    public Transform   sniperSpawnPoint;
    public Transform[] bodyguardSpawnPoints;
    public Transform   targetVIP;

    [Header("プレハブ")]
    public GameObject audienceNPCPrefab;
    public Transform[] audienceSpawnPoints;

    public enum Phase { Lobby, CountDown, Playing, Result }
    public Phase  CurrentPhase  { get; private set; } = Phase.Lobby;
    public float  TimeRemaining { get; private set; }
    public bool   IsPlaying     => CurrentPhase == Phase.Playing;

    public enum Winner { None, Sniper, Bodyguard }
    public Winner GameWinner { get; private set; } = Winner.None;

    public UnityEvent<Phase>  OnPhaseChanged     = new();
    public UnityEvent<float>  OnTimerTick        = new();
    public UnityEvent<Winner> OnGameEnd          = new();
    public UnityEvent         OnSniperShotMissed = new();
    public UnityEvent         OnTargetEliminated = new();
    public UnityEvent         OnSniperCaptured   = new();

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    void Start() => SpawnAudienceNPCs();

    void Update()
    {
        // メインスレッドキューをフラッシュ（NetworkManager側から積まれたコールバック）
        UnityMainThread.Flush();

        if (CurrentPhase != Phase.Playing) return;
        TimeRemaining -= Time.deltaTime;
        OnTimerTick.Invoke(TimeRemaining);
        if (TimeRemaining <= 0f) EndGame(Winner.Bodyguard);
    }

    public void StartCountdown() => StartCoroutine(CountdownRoutine());

    public void ReportTargetEliminated()
    {
        if (!IsPlaying) return;
        OnTargetEliminated.Invoke();
        EndGame(Winner.Sniper);
    }

    public void ReportSniperCaptured()
    {
        if (!IsPlaying) return;
        OnSniperCaptured.Invoke();
        EndGame(Winner.Bodyguard);
    }

    public void ReportShotMissed()
    {
        if (!IsPlaying) return;
        OnSniperShotMissed.Invoke();
        DetectionManager.Instance?.ForceDetected();
    }

    /// <summary>サーバーから受信した残り時間でローカルタイマーを補正する</summary>
    public void SyncRemainingTime(float serverRemainingSeconds)
    {
        if (!IsPlaying) return;
        // 誤差が1秒以上あるときだけ補正（頻繁な補正を防ぐ）
        if (Mathf.Abs(TimeRemaining - serverRemainingSeconds) > 1f)
            TimeRemaining = serverRemainingSeconds;
    }

    public void ReturnToLobby()
    {
        GameWinner = Winner.None;
        TimeRemaining = gameDuration;
        ChangePhase(Phase.Lobby);
    }

    IEnumerator CountdownRoutine()
    {
        ChangePhase(Phase.CountDown);
        yield return new WaitForSeconds(3f);
        TimeRemaining = gameDuration;
        ChangePhase(Phase.Playing);
    }

    void EndGame(Winner winner)
    {
        if (CurrentPhase == Phase.Result) return;
        GameWinner = winner;
        ChangePhase(Phase.Result);
        OnGameEnd.Invoke(winner);
    }

    void ChangePhase(Phase next)
    {
        CurrentPhase = next;
        OnPhaseChanged.Invoke(next);
    }

    void SpawnAudienceNPCs()
    {
        if (audienceNPCPrefab == null) return;
        foreach (var sp in audienceSpawnPoints)
            Instantiate(audienceNPCPrefab, sp.position, sp.rotation);
    }
}
