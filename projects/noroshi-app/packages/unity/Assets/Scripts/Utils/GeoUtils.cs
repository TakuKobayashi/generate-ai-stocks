using UnityEngine;

namespace Noroshi.Utils
{
    public static class GeoUtils
    {
        private const double EarthRadius = 6371e3; // メートル

        /// <summary>Haversine公式による2点間距離（メートル）</summary>
        public static double Distance(double lat1, double lon1, double lat2, double lon2)
        {
            var dLat = (lat2 - lat1) * Mathf.Deg2Rad;
            var dLon = (lon2 - lon1) * Mathf.Deg2Rad;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                  + Math.Cos(lat1 * Mathf.Deg2Rad) * Math.Cos(lat2 * Mathf.Deg2Rad)
                  * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return EarthRadius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }

        /// <summary>
        /// 2点間の方位角（北=0, 東=90, 南=180, 西=270）
        /// </summary>
        public static float Bearing(double lat1, double lon1, double lat2, double lon2)
        {
            var dLon = (lon2 - lon1) * Mathf.Deg2Rad;
            var y = Math.Sin(dLon) * Math.Cos(lat2 * Mathf.Deg2Rad);
            var x = Math.Cos(lat1 * Mathf.Deg2Rad) * Math.Sin(lat2 * Mathf.Deg2Rad)
                  - Math.Sin(lat1 * Mathf.Deg2Rad) * Math.Cos(lat2 * Mathf.Deg2Rad) * Math.Cos(dLon);
            var bearing = Math.Atan2(y, x) * Mathf.Rad2Deg;
            return (float)((bearing + 360) % 360);
        }

        /// <summary>
        /// 緯度経度をUnityのワールド座標（XZ平面）に変換
        /// originを基準とした相対位置（メートル単位）
        /// </summary>
        public static Vector3 LatLonToWorld(
            double lat, double lon,
            double originLat, double originLon,
            float altitudeOffset = 0f)
        {
            var dLat = (lat - originLat) * Mathf.Deg2Rad;
            var dLon = (lon - originLon) * Mathf.Deg2Rad;
            var avgLat = ((lat + originLat) / 2) * Mathf.Deg2Rad;

            var z = (float)(dLat * EarthRadius);
            var x = (float)(dLon * EarthRadius * Math.Cos(avgLat));

            return new Vector3(x, altitudeOffset, z);
        }
    }
}
