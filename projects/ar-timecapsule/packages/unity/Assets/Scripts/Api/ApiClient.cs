using System;
using System.Text;
using System.Threading;
using Cysharp.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Networking;
using ARTimeCapsule.Models;

namespace ARTimeCapsule.Api
{
    public class ApiClient : MonoBehaviour
    {
        [Header("API Settings")]
        [SerializeField] private string _baseUrl = "https://your-worker.workers.dev/api/v1";

        public static ApiClient Instance { get; private set; }

        private string _accessToken;
        private string _refreshToken;
        private long   _accessExpiresAt;
        private long   _refreshExpiresAt;

        public bool     IsLoggedIn  => !string.IsNullOrEmpty(_accessToken);
        public UserInfo CurrentUser { get; private set; }

        public event Action OnLoginSuccess;
        public event Action OnLogout;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            LoadFromPrefs();
        }

        // ── Auth ──────────────────────────────────────────────────────────────

        public async UniTask<ApiResponse<LoginResponse>> LoginAsync(string email, string password, CancellationToken ct = default)
        {
            var res = await PostAsync<LoginResponse>("/auth/login", new LoginRequest { Email = email, Password = password }, false, ct);
            if (res.Success) ApplyAuth(res.Data);
            return res;
        }

        public async UniTask LogoutAsync(CancellationToken ct = default)
        {
            if (!string.IsNullOrEmpty(_refreshToken))
                await PostAsync<object>("/auth/logout", new RefreshRequest { RefreshToken = _refreshToken }, ct: ct);
            ClearAuth();
            OnLogout?.Invoke();
        }

        // ── TimeCapsule ───────────────────────────────────────────────────────

        public async UniTask<ApiResponse<PaginatedResponse<TimeCapsuleListItem>>> GetNearbyCapsules(
            double lat, double lng, int radius = 500, CancellationToken ct = default)
        {
            return await GetAsync<PaginatedResponse<TimeCapsuleListItem>>(
                $"/time-capsules/nearby?lat={lat:F7}&lng={lng:F7}&radius={radius}", ct: ct);
        }

        public async UniTask<ApiResponse<TimeCapsuleDetail>> GetCapsuleDetailAsync(string id, CancellationToken ct = default)
            => await GetAsync<TimeCapsuleDetail>($"/time-capsules/{id}", ct: ct);

        public async UniTask<ApiResponse<object>> RedeemCouponAsync(string couponId, double lat, double lng, CancellationToken ct = default)
            => await PostAsync<object>($"/coupons/{couponId}/redeem", new RedeemCouponRequest { Latitude = lat, Longitude = lng }, ct: ct);

        // ── HTTP helpers ──────────────────────────────────────────────────────

        public async UniTask<ApiResponse<T>> GetAsync<T>(string path, bool auth = true, CancellationToken ct = default)
        {
            if (auth) await EnsureTokenAsync(ct);
            using var req = UnityWebRequest.Get(_baseUrl + path);
            SetHeaders(req, auth);
            await req.SendWebRequest().ToUniTask(cancellationToken: ct);
            return Parse<T>(req);
        }

        public async UniTask<ApiResponse<T>> PostAsync<T>(string path, object body, bool auth = true, CancellationToken ct = default)
        {
            if (auth) await EnsureTokenAsync(ct);
            var json = JsonConvert.SerializeObject(body);
            using var req = new UnityWebRequest(_baseUrl + path, "POST")
            {
                uploadHandler   = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json)),
                downloadHandler = new DownloadHandlerBuffer(),
            };
            req.SetRequestHeader("Content-Type", "application/json");
            SetHeaders(req, auth);
            await req.SendWebRequest().ToUniTask(cancellationToken: ct);
            return Parse<T>(req);
        }

        private void SetHeaders(UnityWebRequest req, bool withAuth)
        {
            req.SetRequestHeader("Accept", "application/json");
            if (withAuth && !string.IsNullOrEmpty(_accessToken))
                req.SetRequestHeader("Authorization", $"Bearer {_accessToken}");
        }

        private ApiResponse<T> Parse<T>(UnityWebRequest req)
        {
            if (req.result == UnityWebRequest.Result.ConnectionError ||
                req.result == UnityWebRequest.Result.DataProcessingError)
                return new ApiResponse<T> { Success = false, Error = new ApiError { Code = "NETWORK_ERROR", Message = req.error } };
            try
            {
                return JsonConvert.DeserializeObject<ApiResponse<T>>(req.downloadHandler.text);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ApiClient] Parse error: {ex.Message}");
                return new ApiResponse<T> { Success = false, Error = new ApiError { Code = "PARSE_ERROR", Message = ex.Message } };
            }
        }

        // ── Token refresh ─────────────────────────────────────────────────────

        private async UniTask EnsureTokenAsync(CancellationToken ct)
        {
            if (string.IsNullOrEmpty(_accessToken) || string.IsNullOrEmpty(_refreshToken)) return;
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() < _accessExpiresAt - 60) return;

            using var req = new UnityWebRequest(_baseUrl + "/auth/refresh", "POST")
            {
                uploadHandler   = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(new RefreshRequest { RefreshToken = _refreshToken }))),
                downloadHandler = new DownloadHandlerBuffer(),
            };
            req.SetRequestHeader("Content-Type", "application/json");
            await req.SendWebRequest().ToUniTask(cancellationToken: ct);

            if (req.result == UnityWebRequest.Result.Success)
            {
                var res = JsonConvert.DeserializeObject<ApiResponse<TokenPair>>(req.downloadHandler.text);
                if (res?.Success == true)
                {
                    _accessToken     = res.Data.AccessToken;
                    _accessExpiresAt = res.Data.AccessExpiresAt;
                    SaveToPrefs();
                }
                else ClearAuth();
            }
        }

        private void ApplyAuth(LoginResponse data)
        {
            CurrentUser       = data.User;
            _accessToken      = data.Tokens.AccessToken;
            _refreshToken     = data.Tokens.RefreshToken;
            _accessExpiresAt  = data.Tokens.AccessExpiresAt;
            _refreshExpiresAt = data.Tokens.RefreshExpiresAt;
            SaveToPrefs();
            OnLoginSuccess?.Invoke();
        }

        private void ClearAuth()
        {
            _accessToken = _refreshToken = null;
            _accessExpiresAt = _refreshExpiresAt = 0;
            CurrentUser = null;
            PlayerPrefs.DeleteKey("ar_at"); PlayerPrefs.DeleteKey("ar_rt");
            PlayerPrefs.DeleteKey("ar_ate"); PlayerPrefs.DeleteKey("ar_rte");
            PlayerPrefs.DeleteKey("ar_user"); PlayerPrefs.Save();
        }

        private void SaveToPrefs()
        {
            PlayerPrefs.SetString("ar_at",   _accessToken);
            PlayerPrefs.SetString("ar_rt",   _refreshToken);
            PlayerPrefs.SetString("ar_ate",  _accessExpiresAt.ToString());
            PlayerPrefs.SetString("ar_rte",  _refreshExpiresAt.ToString());
            PlayerPrefs.SetString("ar_user", JsonConvert.SerializeObject(CurrentUser));
            PlayerPrefs.Save();
        }

        private void LoadFromPrefs()
        {
            _accessToken      = PlayerPrefs.GetString("ar_at",  null);
            _refreshToken     = PlayerPrefs.GetString("ar_rt",  null);
            _accessExpiresAt  = long.TryParse(PlayerPrefs.GetString("ar_ate", "0"), out var a) ? a : 0;
            _refreshExpiresAt = long.TryParse(PlayerPrefs.GetString("ar_rte", "0"), out var r) ? r : 0;
            var json = PlayerPrefs.GetString("ar_user", null);
            if (!string.IsNullOrEmpty(json))
                try { CurrentUser = JsonConvert.DeserializeObject<UserInfo>(json); } catch { }
        }
    }
}
