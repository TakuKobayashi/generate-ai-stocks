using System;

namespace Noroshi.Models
{
    [Serializable]
    public class NoroshiModel
    {
        public string id;
        public string userId;
        public double latitude;
        public double longitude;
        public string geohash;
        public string address;
        public string message;
        public string startAt;
        public string endAt;
        public string createdAt;

        /// <summary>現在有効な狼煙かどうか</summary>
        public bool IsActive()
        {
            var now = DateTime.UtcNow;
            var start = DateTime.Parse(startAt).ToUniversalTime();
            var end = DateTime.Parse(endAt).ToUniversalTime();
            return now >= start && now <= end;
        }
    }

    [Serializable]
    public class CreateNoroshiRequest
    {
        public string userId;
        public double latitude;
        public double longitude;
        public string address;
        public string message;
        public string startAt;
        public string endAt;
    }

    [Serializable]
    public class SearchNoroshiResponse
    {
        public bool success;
        public SearchNoroshiData data;
    }

    [Serializable]
    public class SearchNoroshiData
    {
        public NoroshiModel[] noroshis;
    }

    [Serializable]
    public class CreateNoroshiResponse
    {
        public bool success;
        public NoroshiModel data;
        public string error;
    }
}
