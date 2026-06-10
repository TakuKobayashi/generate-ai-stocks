using System;
using UnityEngine;
using UnityEngine.Events;

namespace Noroshi.UI
{
    /// <summary>
    /// 地図表示コンポーネント
    /// UniWebView（推奨）またはネイティブWebViewを使用
    /// StreamingAssets/map.html をロードしてLeaflet.jsで地図を表示
    /// </summary>
    public class NoroshiMapController : MonoBehaviour
    {
        [Header("Map Settings")]
        [SerializeField] private RectTransform mapContainer;
        [SerializeField] private float defaultZoom = 15f;

        // 地図上でタップした座標・住所を通知
        [HideInInspector]
        public UnityEvent<double, double, string> OnLocationSelected = new UnityEvent<double, double, string>();

        private double _currentLat = 35.681236;
        private double _currentLon = 139.767125; // デフォルト: 東京

#if UNITY_ANDROID || UNITY_IOS
        private UniWebView _webView;
#endif

        private void Start()
        {
            InitWebView();
        }

        private void InitWebView()
        {
#if UNITY_ANDROID || UNITY_IOS
            _webView = gameObject.AddComponent<UniWebView>();

            // mapContainer の Rect に合わせて配置
            var rect = GetScreenRect(mapContainer);
            _webView.Frame = rect;

            // JavaScript → Unity メッセージ受信
            _webView.OnMessageReceived += OnWebViewMessage;

            // StreamingAssets の map.html をロード
            var mapUrl = UniWebViewHelper.StreamingAssetURLForPath("map/index.html");
            _webView.Load(mapUrl);
            _webView.Show();
#endif
        }

#if UNITY_ANDROID || UNITY_IOS
        private void OnWebViewMessage(UniWebView webView, UniWebViewMessage message)
        {
            // map.html から noroshi://select?lat=xx&lon=xx&address=xx の形式で通知
            if (message.Scheme != "noroshi" || message.Path != "select") return;

            if (!double.TryParse(message.Args["lat"], out var lat)) return;
            if (!double.TryParse(message.Args["lon"], out var lon)) return;
            var address = message.Args.ContainsKey("address") ? message.Args["address"] : "";

            OnLocationSelected.Invoke(lat, lon, address);
        }
#endif

        /// <summary>地図を指定座標に移動</summary>
        public void MoveMap(double lat, double lon)
        {
            _currentLat = lat;
            _currentLon = lon;
#if UNITY_ANDROID || UNITY_IOS
            _webView?.EvaluateJavaScript($"moveMap({lat}, {lon});", null);
#endif
        }

        /// <summary>ピンを立てる</summary>
        public void SetMarker(double lat, double lon)
        {
#if UNITY_ANDROID || UNITY_IOS
            _webView?.EvaluateJavaScript($"setMarker({lat}, {lon});", null);
#endif
        }

        private Rect GetScreenRect(RectTransform rt)
        {
            var corners = new Vector3[4];
            rt.GetWorldCorners(corners);
            var min = RectTransformUtility.WorldToScreenPoint(null, corners[0]);
            var max = RectTransformUtility.WorldToScreenPoint(null, corners[2]);
            return new Rect(min.x, min.y, max.x - min.x, max.y - min.y);
        }

        private void OnDestroy()
        {
#if UNITY_ANDROID || UNITY_IOS
            if (_webView != null)
            {
                _webView.OnMessageReceived -= OnWebViewMessage;
                Destroy(_webView);
            }
#endif
        }
    }
}
