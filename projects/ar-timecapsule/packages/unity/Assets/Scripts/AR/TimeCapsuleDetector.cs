using System.Collections.Generic;
using System.Threading;
using Cysharp.Threading.Tasks;
using UnityEngine;
using ARTimeCapsule.Api;
using ARTimeCapsule.Audio;
using ARTimeCapsule.Models;

namespace ARTimeCapsule.AR
{
    /// <summary>
    /// GPS を定期ポーリングし、近傍のタイムカプセルを検出して AR 空間に配置します。
    /// discoverRadiusMeters はサーバー側で設定された値を使います。
    /// </summary>
    public class TimeCapsuleDetector : MonoBehaviour
    {
        [Header("Detection")]
        [SerializeField] private float _pollIntervalSeconds = 5f;
        [SerializeField] private float _defaultSearchRadiusM = 200f;

        [Header("Prefabs")]
        [SerializeField] private GameObject        _capsulePrefab;
        [SerializeField] private SpatialAudioPlayer _audioPlayerPrefab;

        private readonly Dictionary<string, CapsuleEntry> _spawned = new();
        private CancellationTokenSource _cts;

        private void OnEnable()
        {
            _cts = new CancellationTokenSource();
            PollLoopAsync(_cts.Token).Forget();
        }

        private void OnDisable()
        {
            _cts?.Cancel();
            _cts?.Dispose();
        }

        private async UniTaskVoid PollLoopAsync(CancellationToken ct)
        {
#if UNITY_EDITOR
            // エディタでは東京駅をデフォルト位置とする
            await RunPoll(35.6812, 139.7671, ct);
            return;
#endif
#pragma warning disable CS0162
            if (!Input.location.isEnabledByUser) { Debug.LogWarning("[Detector] Location not enabled"); return; }
            Input.location.Start(5f, 1f);
            int wait = 20;
            while (Input.location.status == LocationServiceStatus.Initializing && wait-- > 0)
                await UniTask.Delay(1000, cancellationToken: ct);
            if (Input.location.status != LocationServiceStatus.Running) { Debug.LogError("[Detector] Location failed"); return; }
            while (!ct.IsCancellationRequested)
            {
                var loc = Input.location.lastData;
                await RunPoll(loc.latitude, loc.longitude, ct);
                await UniTask.Delay((int)(_pollIntervalSeconds * 1000), cancellationToken: ct);
            }
#pragma warning restore CS0162
        }

        private async UniTask RunPoll(double lat, double lng, CancellationToken ct)
        {
            var res = await ApiClient.Instance.GetNearbyCapsules(lat, lng, (int)_defaultSearchRadiusM, ct);
            if (!res.Success) return;

            foreach (var item in res.Data.Items)
            {
                if (_spawned.ContainsKey(item.Id)) continue;

                // カプセル固有の発見半径チェック
                if (item.DistanceMeters > item.DiscoverRadiusMeters) continue;

                var detail = await ApiClient.Instance.GetCapsuleDetailAsync(item.Id, ct);
                if (!detail.Success) continue;

                SpawnCapsule(detail.Data, lat, lng);
            }

            // 遠ざかったカプセルを非アクティブ化
            foreach (var kv in _spawned)
            {
                var dist = Haversine(lat, lng, kv.Value.Latitude, kv.Value.Longitude);
                if (dist > kv.Value.DiscoverRadiusMeters * 2f) kv.Value.Deactivate();
            }
        }

        private void SpawnCapsule(TimeCapsuleDetail detail, double userLat, double userLng)
        {
            var pos = GpsToLocal(detail.Latitude, detail.Longitude, userLat, userLng);
            var go  = Instantiate(_capsulePrefab, pos, Quaternion.identity);
            go.name = $"Capsule_{detail.Id}";

            SpatialAudioPlayer audio = null;
            if (detail.Audio?.SignedUrl != null)
            {
                audio = Instantiate(_audioPlayerPrefab, pos, Quaternion.identity);
                audio.LoadAndPlay(detail.Audio.SignedUrl, loop: true).Forget();
            }

            _spawned[detail.Id] = new CapsuleEntry(detail, go, audio);
            Debug.Log($"[Detector] Spawned: {detail.Title} ({detail.DiscoverRadiusMeters}m radius)");
        }

        private static Vector3 GpsToLocal(double tLat, double tLng, double oLat, double oLng)
        {
            const double R = 6_371_000;
            const double D = System.Math.PI / 180;
            float z = (float)(R * (tLat - oLat) * D);
            float x = (float)(R * (tLng - oLng) * D * System.Math.Cos(oLat * D));
            return new Vector3(x, 0f, z);
        }

        private static double Haversine(double lat1, double lng1, double lat2, double lng2)
        {
            const double R = 6_371_000;
            const double D = System.Math.PI / 180;
            double dLat = (lat2 - lat1) * D, dLng = (lng2 - lng1) * D;
            double a = System.Math.Sin(dLat / 2) * System.Math.Sin(dLat / 2)
                     + System.Math.Cos(lat1 * D) * System.Math.Cos(lat2 * D)
                     * System.Math.Sin(dLng / 2) * System.Math.Sin(dLng / 2);
            return R * 2 * System.Math.Atan2(System.Math.Sqrt(a), System.Math.Sqrt(1 - a));
        }

        private class CapsuleEntry
        {
            public double Latitude            { get; }
            public double Longitude           { get; }
            public int    DiscoverRadiusMeters { get; }
            private readonly GameObject        _go;
            private readonly SpatialAudioPlayer _audio;

            public CapsuleEntry(TimeCapsuleDetail d, GameObject go, SpatialAudioPlayer audio)
            {
                Latitude             = d.Latitude;
                Longitude            = d.Longitude;
                DiscoverRadiusMeters = d.DiscoverRadiusMeters;
                _go    = go;
                _audio = audio;
            }

            public void Deactivate()
            {
                if (_go != null) _go.SetActive(false);
                _audio?.Stop();
            }
        }
    }
}
