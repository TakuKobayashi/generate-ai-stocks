using Cysharp.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ARTimeCapsule.Api;
using ARTimeCapsule.Models;

namespace ARTimeCapsule.UI
{
    public class CapsuleInfoUI : MonoBehaviour
    {
        [Header("Panel")]
        [SerializeField] private GameObject _panel;

        [Header("Info")]
        [SerializeField] private TMP_Text _titleText;
        [SerializeField] private TMP_Text _messageText;
        [SerializeField] private TMP_Text _distanceText;

        [Header("Coupon")]
        [SerializeField] private GameObject _couponSection;
        [SerializeField] private TMP_Text   _couponTitleText;
        [SerializeField] private TMP_Text   _couponShopText;
        [SerializeField] private Button     _redeemButton;
        [SerializeField] private TMP_Text   _redeemResultText;

        [SerializeField] private Button _closeButton;

        private TimeCapsuleDetail _current;
        private double _userLat, _userLng;

        private void Start()
        {
            _closeButton.onClick.AddListener(() => _panel.SetActive(false));
            _redeemButton.onClick.AddListener(() => RedeemAsync().Forget());
            _panel.SetActive(false);
        }

        public void Show(TimeCapsuleDetail detail, double userLat, double userLng)
        {
            _current = detail; _userLat = userLat; _userLng = userLng;
            _titleText.text   = detail.Title;
            _messageText.text = string.IsNullOrEmpty(detail.Message) ? "（メッセージなし）" : detail.Message;

            var dist = Haversine(userLat, userLng, detail.Latitude, detail.Longitude);
            _distanceText.text = $"{dist:F0} m";

            if (detail.Coupon != null)
            {
                _couponSection.SetActive(true);
                _couponTitleText.text    = detail.Coupon.Title;
                _couponShopText.text     = detail.Coupon.ShopName;
                _redeemButton.interactable = true;
                _redeemResultText.text   = "";
            }
            else _couponSection.SetActive(false);

            _panel.SetActive(true);
        }

        private async UniTaskVoid RedeemAsync()
        {
            if (_current?.Coupon == null) return;
            _redeemButton.interactable = false;
            _redeemResultText.text = "取得中...";

            var res = await ApiClient.Instance.RedeemCouponAsync(
                _current.Coupon.Id, _userLat, _userLng, this.GetCancellationTokenOnDestroy());

            if (res.Success) _redeemResultText.text = "✅ クーポンを取得しました！";
            else { _redeemResultText.text = $"❌ {res.Error?.Message ?? "取得に失敗しました"}"; _redeemButton.interactable = true; }
        }

        private static double Haversine(double lat1, double lng1, double lat2, double lng2)
        {
            const double R = 6_371_000, D = System.Math.PI / 180;
            double dLat = (lat2 - lat1) * D, dLng = (lng2 - lng1) * D;
            double a = System.Math.Sin(dLat / 2) * System.Math.Sin(dLat / 2)
                     + System.Math.Cos(lat1 * D) * System.Math.Cos(lat2 * D)
                     * System.Math.Sin(dLng / 2) * System.Math.Sin(dLng / 2);
            return R * 2 * System.Math.Atan2(System.Math.Sqrt(a), System.Math.Sqrt(1 - a));
        }
    }
}
