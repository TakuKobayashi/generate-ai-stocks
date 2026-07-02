// NetworkGameSync.cs - RoomClient ←→ GameManager 橋渡し (Unity 6)
using PlateauSniper.Network;
using UnityEngine;

public class NetworkGameSync : MonoBehaviour
{
    [SerializeField] bool _isHost = false;

    void Start()
    {
        var rc = RoomClient.Instance;
        var gm = GameManager.Instance;
        if (rc == null || gm == null) return;

        rc.OnGamePhase.AddListener(ev =>
        {
            switch (ev.Phase)
            {
                case "countdown":
                    if (gm.CurrentPhase == GameManager.Phase.Lobby) gm.StartCountdown();
                    break;
                case "playing":
                    if (ev.RemainingSec.HasValue) gm.SyncRemainingTime(ev.RemainingSec.Value);
                    break;
                case "result":
                    if (ev.Winner == "sniper")         gm.ReportTargetEliminated();
                    else if (ev.Winner == "bodyguard") gm.ReportSniperCaptured();
                    break;
                case "lobby":
                    gm.ReturnToLobby(); break;
            }
        });

        rc.OnSniperFired.AddListener(msg =>
            BulletEffectManager.Instance?.PlayShotEffect(
                msg.Origin, msg.Direction, msg.Hit, msg.HitPoint));

        rc.OnGameEvent.AddListener(ev =>
        {
            switch (ev.Ev)
            {
                case DcGameEvent.TargetEliminated: gm.ReportTargetEliminated(); break;
                case DcGameEvent.SniperCaptured:   gm.ReportSniperCaptured();   break;
                case DcGameEvent.ShotMissed:       gm.ReportShotMissed();       break;
                case DcGameEvent.SniperDetected:   DetectionManager.Instance?.ForceDetected(); break;
            }
        });

        rc.OnCoverOrder.AddListener(order =>
        {
            if (order.BgId == rc.MyClientId) return;
            var vip = FindAnyObjectByType<VIPController>();
            var cp  = CoverPoint.FindByName(order.Cp);
            if (vip != null && cp != null) vip.MoveToCover(cp.transform);
        });

        rc.OnDispatchOrder.AddListener(order =>
        {
            if (order.BgId == rc.MyClientId) return;
            var guard  = NpcGuard.FindById(order.Gid);
            var sniperT= FindAnyObjectByType<RemotePlayerRegistry>()?.GetSniperGhostTransform();
            if (guard != null && sniperT != null) guard.DispatchToCapture(sniperT);
        });

        rc.OnConnectionChanged.AddListener(c => Debug.Log($"[NetworkGameSync] 接続: {c}"));

        gm.OnPhaseChanged.AddListener(phase =>
        {
            if (!_isHost) return;
            if (phase == GameManager.Phase.CountDown) rc.SendStartGame();
            if (phase == GameManager.Phase.Lobby)     rc.SendResetGame();
        });
    }
}
