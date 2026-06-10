using System;
using System.Collections.Generic;
using UnityEngine;
using Firebase.Messaging;
using Noroshi.Models;
using Noroshi.Database;

namespace Noroshi.Notifications
{
    /// <summary>
    /// FCM Push通知受信ハンドラー
    /// - data-only メッセージを受信してローカルDBに保存（通知バーには表示しない）
    /// - Firebase Messaging SDK が必要
    /// </summary>
    public class NoroshiNotificationHandler : MonoBehaviour
    {
        private static NoroshiNotificationHandler _instance;

        private void Awake()
        {
            if (_instance != null) { Destroy(gameObject); return; }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            InitializeFirebase();
        }

        private void InitializeFirebase()
        {
            Firebase.FirebaseApp.CheckAndFixDependenciesAsync().ContinueWith(task =>
            {
                var status = task.Result;
                if (status == Firebase.DependencyStatus.Available)
                {
                    FirebaseMessaging.TokenReceived   += OnTokenReceived;
                    FirebaseMessaging.MessageReceived += OnMessageReceived;

                    // FCMトークンを取得してサーバーに登録
                    FirebaseMessaging.GetTokenAsync().ContinueWith(tokenTask =>
                    {
                        if (!tokenTask.IsFaulted && !tokenTask.IsCanceled)
                            RegisterToken(tokenTask.Result);
                    });
                }
                else
                {
                    Debug.LogError($"[NoroshiNotificationHandler] Firebase dependency error: {status}");
                }
            });
        }

        private void OnTokenReceived(object sender, TokenReceivedEventArgs e)
        {
            Debug.Log($"[NoroshiNotificationHandler] FCM Token: {e.Token}");
            RegisterToken(e.Token);
        }

        private void RegisterToken(string token)
        {
            if (!Noroshi.Utils.AppManager.Instance.HasLocation) return;

            // Coroutine はメインスレッドで実行が必要
            UnityMainThreadDispatcher.Instance.Enqueue(() =>
            {
                Noroshi.Utils.AppManager.Instance.StartCoroutine(
                    RegisterTokenCoroutine(token)
                );
            });
        }

        private System.Collections.IEnumerator RegisterTokenCoroutine(string token)
        {
            // 位置情報が取得されるまで待機
            while (!Noroshi.Utils.AppManager.Instance.HasLocation)
                yield return new WaitForSeconds(1f);

            var task = Noroshi.Utils.AppManager.Instance.ApiClient.RegisterDeviceToken(
                token,
                Noroshi.Utils.AppManager.Instance.CurrentLatitude,
                Noroshi.Utils.AppManager.Instance.CurrentLongitude
            );
            yield return new WaitUntil(() => task.IsCompleted);
        }

        private void OnMessageReceived(object sender, MessageReceivedEventArgs e)
        {
            var data = e.Message.Data;

            if (!data.TryGetValue("type", out var type) || type != "new_noroshi")
                return;

            // Push通知を通知バーに表示せず、データをローカルDBに保存
            try
            {
                var noroshi = new NoroshiModel
                {
                    id        = GetData(data, "id"),
                    userId    = GetData(data, "userId"),
                    latitude  = double.Parse(GetData(data, "latitude")) / 1e7,
                    longitude = double.Parse(GetData(data, "longitude")) / 1e7,
                    geohash   = GetData(data, "geohash"),
                    address   = GetData(data, "address"),
                    message   = GetData(data, "message"),
                    startAt   = DateTimeOffset.FromUnixTimeMilliseconds(long.Parse(GetData(data, "startAt"))).ToString("o"),
                    endAt     = DateTimeOffset.FromUnixTimeMilliseconds(long.Parse(GetData(data, "endAt"))).ToString("o"),
                    createdAt = DateTimeOffset.FromUnixTimeMilliseconds(long.Parse(GetData(data, "createdAt"))).ToString("o"),
                };

                UnityMainThreadDispatcher.Instance.Enqueue(() =>
                {
                    NoroshiRecord.Save(noroshi);
                    Debug.Log($"[NoroshiNotificationHandler] Saved noroshi from push: {noroshi.id}");
                });
            }
            catch (Exception ex)
            {
                Debug.LogError($"[NoroshiNotificationHandler] Failed to parse push data: {ex.Message}");
            }
        }

        private static string GetData(IDictionary<string, string> data, string key)
            => data.TryGetValue(key, out var v) ? v : "";

        private void OnDestroy()
        {
            FirebaseMessaging.TokenReceived   -= OnTokenReceived;
            FirebaseMessaging.MessageReceived -= OnMessageReceived;
        }
    }
}
