using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using Noroshi.Models;
using Noroshi.Utils;

namespace Noroshi.UI
{
    /// <summary>
    /// 狼煙作成画面
    /// - 開始時刻 / 終了時刻 / 住所 / メッセージ 入力
    /// - 地図コンポーネント連携
    /// </summary>
    public class CreateNoroshiSceneController : MonoBehaviour
    {
        [Header("Input Fields")]
        [SerializeField] private TMP_InputField startAtInput;
        [SerializeField] private TMP_InputField endAtInput;
        [SerializeField] private TMP_InputField addressInput;
        [SerializeField] private TMP_InputField messageInput;

        [Header("Buttons")]
        [SerializeField] private Button submitButton;
        [SerializeField] private Button backButton;
        [SerializeField] private Button currentLocationButton;

        [Header("Map")]
        [SerializeField] private NoroshiMapController mapController;

        [Header("UI")]
        [SerializeField] private GameObject loadingOverlay;
        [SerializeField] private TMPro.TextMeshProUGUI errorText;

        private double _selectedLatitude;
        private double _selectedLongitude;

        // ─── Lifecycle ────────────────────────────────────────────────────

        private void Start()
        {
            // デフォルト値をセット
            var now = DateTime.Now;
            startAtInput.text = now.ToString("yyyy-MM-dd HH:mm");
            endAtInput.text   = now.AddHours(1).ToString("yyyy-MM-dd HH:mm");

            // 現在地をデフォルト位置に
            if (AppManager.Instance.HasLocation)
            {
                _selectedLatitude  = AppManager.Instance.CurrentLatitude;
                _selectedLongitude = AppManager.Instance.CurrentLongitude;
                mapController?.MoveMap(_selectedLatitude, _selectedLongitude);
                StartCoroutine(FetchAddressFromCoords(_selectedLatitude, _selectedLongitude));
            }

            // 住所入力変更 → 地図移動
            addressInput.onEndEdit.AddListener(OnAddressEndEdit);

            // 地図タップ → 住所欄更新
            mapController?.OnLocationSelected.AddListener(OnMapLocationSelected);

            submitButton.onClick.AddListener(OnSubmitPressed);
            backButton.onClick.AddListener(OnBackPressed);
            currentLocationButton.onClick.AddListener(OnCurrentLocationPressed);
        }

        // ─── Event Handlers ───────────────────────────────────────────────

        private void OnAddressEndEdit(string address)
        {
            if (string.IsNullOrWhiteSpace(address)) return;
            StartCoroutine(GeocodeAddress(address));
        }

        private void OnMapLocationSelected(double lat, double lon, string address)
        {
            _selectedLatitude  = lat;
            _selectedLongitude = lon;
            if (!string.IsNullOrEmpty(address))
                addressInput.text = address;
        }

        private void OnCurrentLocationPressed()
        {
            if (!AppManager.Instance.HasLocation) return;
            _selectedLatitude  = AppManager.Instance.CurrentLatitude;
            _selectedLongitude = AppManager.Instance.CurrentLongitude;
            mapController?.MoveMap(_selectedLatitude, _selectedLongitude);
            StartCoroutine(FetchAddressFromCoords(_selectedLatitude, _selectedLongitude));
        }

        private void OnSubmitPressed()
        {
            StartCoroutine(SubmitNoroshi());
        }

        private void OnBackPressed()
        {
            SceneManager.LoadScene("MainScene");
        }

        // ─── Submit ───────────────────────────────────────────────────────

        private IEnumerator SubmitNoroshi()
        {
            errorText.text = "";

            if (!ValidateInputs(out var startAt, out var endAt, out var errorMsg))
            {
                errorText.text = errorMsg;
                yield break;
            }

            ShowLoading(true);

            var req = new CreateNoroshiRequest
            {
                userId    = AppManager.Instance.UserId,
                latitude  = _selectedLatitude,
                longitude = _selectedLongitude,
                address   = addressInput.text.Trim(),
                message   = messageInput.text.Trim(),
                startAt   = startAt.ToUniversalTime().ToString("o"),
                endAt     = endAt.ToUniversalTime().ToString("o"),
            };

            var task = AppManager.Instance.ApiClient.CreateNoroshi(req);
            yield return new WaitUntil(() => task.IsCompleted);

            ShowLoading(false);

            if (task.Result != null)
            {
                // ローカルDBにも保存
                Noroshi.Database.NoroshiRecord.Save(task.Result);
                SceneManager.LoadScene("MainScene");
            }
            else
            {
                errorText.text = "狼煙の送信に失敗しました。もう一度お試しください。";
            }
        }

        // ─── Geocoding ────────────────────────────────────────────────────

        /// <summary>住所 → 座標（Nominatim使用）</summary>
        private IEnumerator GeocodeAddress(string address)
        {
            var url = $"https://nominatim.openstreetmap.org/search?q={UnityEngine.Networking.UnityWebRequest.EscapeURL(address)}&format=json&limit=1";
            using var req = UnityEngine.Networking.UnityWebRequest.Get(url);
            req.SetRequestHeader("User-Agent", "NoroshiApp/1.0");
            yield return req.SendWebRequest();

            if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success) yield break;

            var results = JsonHelper.FromJsonArray<GeocodingResult>(req.downloadHandler.text);
            if (results == null || results.Length == 0) yield break;

            _selectedLatitude  = double.Parse(results[0].lat);
            _selectedLongitude = double.Parse(results[0].lon);
            mapController?.MoveMap(_selectedLatitude, _selectedLongitude);
        }

        /// <summary>座標 → 住所（Nominatim逆ジオコーディング）</summary>
        private IEnumerator FetchAddressFromCoords(double lat, double lon)
        {
            var url = $"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json";
            using var req = UnityEngine.Networking.UnityWebRequest.Get(url);
            req.SetRequestHeader("User-Agent", "NoroshiApp/1.0");
            yield return req.SendWebRequest();

            if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success) yield break;

            var result = JsonUtility.FromJson<ReverseGeocodingResult>(req.downloadHandler.text);
            if (result != null && !string.IsNullOrEmpty(result.display_name))
                addressInput.text = result.display_name;
        }

        // ─── Validation ───────────────────────────────────────────────────

        private bool ValidateInputs(out DateTime startAt, out DateTime endAt, out string errorMsg)
        {
            startAt  = DateTime.MinValue;
            endAt    = DateTime.MinValue;
            errorMsg = "";

            if (!DateTime.TryParse(startAtInput.text, out startAt))
            {
                errorMsg = "開始時刻の形式が正しくありません"; return false;
            }
            if (!DateTime.TryParse(endAtInput.text, out endAt))
            {
                errorMsg = "終了時刻の形式が正しくありません"; return false;
            }
            if (endAt <= startAt)
            {
                errorMsg = "終了時刻は開始時刻より後にしてください"; return false;
            }
            if (string.IsNullOrWhiteSpace(addressInput.text))
            {
                errorMsg = "場所を入力してください"; return false;
            }

            return true;
        }

        private void ShowLoading(bool show)
        {
            if (loadingOverlay != null) loadingOverlay.SetActive(show);
        }

        // ─── Helper Classes ───────────────────────────────────────────────

        [Serializable] private class GeocodingResult     { public string lat; public string lon; }
        [Serializable] private class ReverseGeocodingResult { public string display_name; }
    }

    /// <summary>UnityのJsonUtilityはルート配列を非対応なのでラッパー</summary>
    public static class JsonHelper
    {
        public static T[] FromJsonArray<T>(string json)
        {
            var wrapped = "{\"array\":" + json + "}";
            var wrapper = JsonUtility.FromJson<ArrayWrapper<T>>(wrapped);
            return wrapper?.array;
        }

        [Serializable] private class ArrayWrapper<T> { public T[] array; }
    }
}
