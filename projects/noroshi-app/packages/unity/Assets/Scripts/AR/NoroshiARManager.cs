using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using Google.XR.ARCoreExtensions;
using Noroshi.Models;
using Noroshi.Database;
using Noroshi.Utils;

namespace Noroshi.AR
{
    /// <summary>
    /// ARシーンで狼煙オブジェクトを配置・管理する
    /// - ARCore Geospatial API (Android) / ARKit (iOS) で位置アンカーを使用
    /// - 半径1km以内の狼煙のみ表示
    /// - 1分ごとにサーバーからデータを更新
    /// </summary>
    public class NoroshiARManager : MonoBehaviour
    {
        [Header("AR Components")]
        [SerializeField] private ARAnchorManager anchorManager;
        [SerializeField] private AREarthManager earthManager;

        [Header("Noroshi Prefab")]
        [SerializeField] private GameObject noroshiPrefab;

        [Header("Settings")]
        [SerializeField] private float visibleRadiusMeters = 1000f;
        [SerializeField] private float refreshIntervalSeconds = 60f;
        [SerializeField] private float noroshiAltitude = 0f; // 地面からの高さ(m)

        private readonly Dictionary<string, (ARGeospatialAnchor anchor, GameObject go)> _placed
            = new Dictionary<string, (ARGeospatialAnchor, GameObject)>();

        private Coroutine _refreshCoroutine;

        // ─── Lifecycle ────────────────────────────────────────────────────

        private void OnEnable()
        {
            // 初回ロード: ローカルDBから表示
            RefreshFromLocal();
            // サーバーポーリング開始
            _refreshCoroutine = StartCoroutine(PeriodicRefresh());
        }

        private void OnDisable()
        {
            if (_refreshCoroutine != null)
                StopCoroutine(_refreshCoroutine);
            ClearAll();
        }

        // ─── Update ───────────────────────────────────────────────────────

        private void Update()
        {
            // Geospatial APIの精度チェック
            if (earthManager == null) return;
            if (earthManager.EarthTrackingState != Google.XR.ARCoreExtensions.TrackingState.Tracking)
                return;

            // 距離に応じてスケール調整（近いほど大きく）
            var myLat = AppManager.Instance.CurrentLatitude;
            var myLon = AppManager.Instance.CurrentLongitude;

            foreach (var kv in _placed)
            {
                if (kv.Value.go == null) continue;
                var model = NoroshiRecord.FindById(kv.Key);
                if (model == null) continue;

                var dist = (float)GeoUtils.Distance(myLat, myLon, model.latitude, model.longitude);
                UpdateNoroshiScale(kv.Value.go, dist);
            }
        }

        // ─── Refresh ──────────────────────────────────────────────────────

        private IEnumerator PeriodicRefresh()
        {
            while (true)
            {
                yield return new WaitForSeconds(refreshIntervalSeconds);
                yield return StartCoroutine(FetchAndRefresh());
            }
        }

        private IEnumerator FetchAndRefresh()
        {
            if (!AppManager.Instance.HasLocation) yield break;

            var fetchTask = AppManager.Instance.ApiClient.FetchNearbyNoroshis(
                AppManager.Instance.CurrentLatitude,
                AppManager.Instance.CurrentLongitude
            );

            yield return new WaitUntil(() => fetchTask.IsCompleted);

            if (fetchTask.Result != null && fetchTask.Result.Length > 0)
            {
                NoroshiRecord.SaveAll(fetchTask.Result);
            }

            RefreshFromLocal();
        }

        private void RefreshFromLocal()
        {
            var actives = NoroshiRecord.FindActive();
            var myLat   = AppManager.Instance.CurrentLatitude;
            var myLon   = AppManager.Instance.CurrentLongitude;

            var activeIds = new HashSet<string>();

            foreach (var noroshi in actives)
            {
                var dist = GeoUtils.Distance(myLat, myLon, noroshi.latitude, noroshi.longitude);
                if (dist > visibleRadiusMeters) continue;

                activeIds.Add(noroshi.id);

                if (!_placed.ContainsKey(noroshi.id))
                    PlaceNoroshi(noroshi);
            }

            // 消えた狼煙を除去
            var toRemove = new List<string>();
            foreach (var id in _placed.Keys)
                if (!activeIds.Contains(id)) toRemove.Add(id);

            foreach (var id in toRemove)
                RemoveNoroshi(id);
        }

        // ─── Place / Remove ───────────────────────────────────────────────

        private void PlaceNoroshi(NoroshiModel model)
        {
            if (earthManager == null ||
                earthManager.EarthTrackingState != Google.XR.ARCoreExtensions.TrackingState.Tracking)
            {
                PlaceNoroshiRelative(model);
                return;
            }

            // ARCore Geospatial API でアンカー配置
            var anchor = anchorManager.AddAnchor(
                model.latitude,
                model.longitude,
                noroshiAltitude,
                Quaternion.identity
            );

            if (anchor == null)
            {
                Debug.LogWarning($"[NoroshiARManager] Failed to place anchor for {model.id}");
                return;
            }

            var go = Instantiate(noroshiPrefab, anchor.transform);
            go.name = $"Noroshi_{model.id}";

            // NoroshiEffect コンポーネントにデータ渡す
            var effect = go.GetComponent<NoroshiEffect>();
            if (effect != null) effect.Initialize(model);

            _placed[model.id] = (anchor, go);
            Debug.Log($"[NoroshiARManager] Placed noroshi {model.id} at ({model.latitude}, {model.longitude})");
        }

        /// <summary>Geospatial非対応時のフォールバック: 相対座標で配置</summary>
        private void PlaceNoroshiRelative(NoroshiModel model)
        {
            var myLat = AppManager.Instance.CurrentLatitude;
            var myLon = AppManager.Instance.CurrentLongitude;
            var worldPos = GeoUtils.LatLonToWorld(model.latitude, model.longitude, myLat, myLon, noroshiAltitude);

            var go = Instantiate(noroshiPrefab, worldPos, Quaternion.identity);
            go.name = $"Noroshi_{model.id}";

            var effect = go.GetComponent<NoroshiEffect>();
            if (effect != null) effect.Initialize(model);

            _placed[model.id] = (null, go);
        }

        private void RemoveNoroshi(string id)
        {
            if (!_placed.TryGetValue(id, out var entry)) return;

            if (entry.go != null) Destroy(entry.go);
            if (entry.anchor != null) Destroy(entry.anchor.gameObject);

            _placed.Remove(id);
        }

        private void ClearAll()
        {
            foreach (var id in new List<string>(_placed.Keys))
                RemoveNoroshi(id);
        }

        // ─── Scale ────────────────────────────────────────────────────────

        /// <summary>
        /// 距離に応じたスケール調整
        /// 1km → 非常に小さい、100m → 通常、10m以内 → 画面いっぱい
        /// </summary>
        private void UpdateNoroshiScale(GameObject go, float distanceMeters)
        {
            float t = Mathf.Clamp01(1f - distanceMeters / visibleRadiusMeters);
            // 指数的にスケールアップ
            float scale = Mathf.Lerp(0.5f, 50f, t * t);
            go.transform.localScale = Vector3.one * scale;
        }
    }
}
