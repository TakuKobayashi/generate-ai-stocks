using System;
using UnityEngine;
using Noroshi.API;
using Noroshi.Database;

namespace Noroshi.Utils
{
    /// <summary>
    /// シングルトン: ユーザーID・APIクライアント・位置情報を一元管理
    /// </summary>
    public class AppManager : MonoBehaviour
    {
        public static AppManager Instance { get; private set; }

        [Header("API Settings")]
        [SerializeField] private string apiBaseUrl = "https://noroshi-server.your-subdomain.workers.dev";

        public NoroshiApiClient ApiClient { get; private set; }
        public string UserId { get; private set; }

        // 最後に取得した現在地
        public double CurrentLatitude  { get; private set; }
        public double CurrentLongitude { get; private set; }
        public bool   HasLocation      { get; private set; }

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // UserID: 永続化（初回のみ生成）
            UserId = PlayerPrefs.GetString("user_id", "");
            if (string.IsNullOrEmpty(UserId))
            {
                UserId = Guid.NewGuid().ToString();
                PlayerPrefs.SetString("user_id", UserId);
                PlayerPrefs.Save();
            }

            NoroshiRecord.Initialize();
            ApiClient = new NoroshiApiClient(apiBaseUrl, UserId);
        }

        private void Start()
        {
            StartCoroutine(UpdateLocation());
        }

        private System.Collections.IEnumerator UpdateLocation()
        {
            if (!Input.location.isEnabledByUser)
            {
                Debug.LogWarning("[AppManager] Location not enabled.");
                yield break;
            }

            Input.location.Start(10f, 5f);

            int timeout = 20;
            while (Input.location.status == LocationServiceStatus.Initializing && timeout > 0)
            {
                yield return new WaitForSeconds(1);
                timeout--;
            }

            if (Input.location.status != LocationServiceStatus.Running)
            {
                Debug.LogError("[AppManager] Location service failed.");
                yield break;
            }

            while (true)
            {
                var info = Input.location.lastData;
                CurrentLatitude  = info.latitude;
                CurrentLongitude = info.longitude;
                HasLocation      = true;
                yield return new WaitForSeconds(10);
            }
        }
    }
}
