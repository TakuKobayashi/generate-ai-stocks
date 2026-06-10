using System;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using Noroshi.Models;

namespace Noroshi.API
{
    public class NoroshiApiClient
    {
        private readonly string _baseUrl;
        private readonly string _userId;

        public NoroshiApiClient(string baseUrl, string userId)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _userId = userId;
        }

        /// <summary>周辺の狼煙を取得</summary>
        public async Task<NoroshiModel[]> FetchNearbyNoroshis(double latitude, double longitude)
        {
            var url = $"{_baseUrl}/api/noroshis?lat={latitude}&lng={longitude}";

            using var request = UnityWebRequest.Get(url);
            request.SetRequestHeader("X-User-Id", _userId);

            var operation = request.SendWebRequest();
            while (!operation.isDone)
                await Task.Yield();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[NoroshiApiClient] FetchNearbyNoroshis failed: {request.error}");
                return Array.Empty<NoroshiModel>();
            }

            var response = JsonUtility.FromJson<SearchNoroshiResponse>(request.downloadHandler.text);
            return response?.data?.noroshis ?? Array.Empty<NoroshiModel>();
        }

        /// <summary>狼煙を上げる</summary>
        public async Task<NoroshiModel> CreateNoroshi(CreateNoroshiRequest req)
        {
            var url = $"{_baseUrl}/api/noroshis";
            var json = JsonUtility.ToJson(req);
            var body = Encoding.UTF8.GetBytes(json);

            using var request = new UnityWebRequest(url, "POST");
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("X-User-Id", _userId);

            var operation = request.SendWebRequest();
            while (!operation.isDone)
                await Task.Yield();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[NoroshiApiClient] CreateNoroshi failed: {request.error}");
                return null;
            }

            var response = JsonUtility.FromJson<CreateNoroshiResponse>(request.downloadHandler.text);
            return response?.success == true ? response.data : null;
        }

        /// <summary>デバイストークンを登録</summary>
        public async Task RegisterDeviceToken(string token, double latitude, double longitude)
        {
            var url = $"{_baseUrl}/api/devices";
            var payload = new DeviceTokenRequest
            {
                userId = _userId,
                token = token,
                latitude = latitude,
                longitude = longitude,
            };
            var json = JsonUtility.ToJson(payload);
            var body = Encoding.UTF8.GetBytes(json);

            using var request = new UnityWebRequest(url, "POST");
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            var operation = request.SendWebRequest();
            while (!operation.isDone)
                await Task.Yield();

            if (request.result != UnityWebRequest.Result.Success)
                Debug.LogError($"[NoroshiApiClient] RegisterDeviceToken failed: {request.error}");
        }

        [Serializable]
        private class DeviceTokenRequest
        {
            public string userId;
            public string token;
            public double latitude;
            public double longitude;
        }
    }
}
