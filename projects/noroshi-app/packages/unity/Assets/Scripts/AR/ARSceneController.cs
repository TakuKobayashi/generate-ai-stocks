using System.Collections;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using Google.XR.ARCoreExtensions;
using Noroshi.Utils;

namespace Noroshi.AR
{
    /// <summary>
    /// ARシーンのエントリーポイント
    /// - ARSession・Geospatial API の初期化待ち
    /// - 準備完了後に NoroshiARManager を有効化
    /// </summary>
    public class ARSceneController : MonoBehaviour
    {
        [Header("AR Components")]
        [SerializeField] private ARSession arSession;
        [SerializeField] private AREarthManager earthManager;
        [SerializeField] private NoroshiARManager noroshiARManager;

        [Header("UI")]
        [SerializeField] private GameObject loadingPanel;
        [SerializeField] private TMPro.TextMeshProUGUI statusText;
        [SerializeField] private GameObject noLocationPanel;

        private bool _isReady = false;

        private void Start()
        {
            noroshiARManager.enabled = false;
            ShowLoading("AR を初期化中...");
            StartCoroutine(WaitForARReady());
        }

        private IEnumerator WaitForARReady()
        {
            // 位置情報待ち
            float timeout = 20f;
            while (!AppManager.Instance.HasLocation && timeout > 0)
            {
                ShowLoading("位置情報を取得中...");
                yield return new WaitForSeconds(0.5f);
                timeout -= 0.5f;
            }

            if (!AppManager.Instance.HasLocation)
            {
                loadingPanel.SetActive(false);
                noLocationPanel.SetActive(true);
                yield break;
            }

            // ARSession 開始待ち
            yield return new WaitUntil(() =>
                ARSession.state == ARSessionState.SessionTracking);

            ShowLoading("Geospatial API を初期化中...");

            // Geospatial API 対応チェック（最大15秒）
            float geospatialTimeout = 15f;
            while (geospatialTimeout > 0)
            {
                if (earthManager != null &&
                    earthManager.EarthTrackingState == Google.XR.ARCoreExtensions.TrackingState.Tracking)
                {
                    var pose = earthManager.CameraGeospatialPose;
                    if (pose.HorizontalAccuracy < 20) // 20m精度以内
                        break;
                }
                yield return new WaitForSeconds(0.5f);
                geospatialTimeout -= 0.5f;
            }

            if (geospatialTimeout <= 0)
                Debug.LogWarning("[ARSceneController] Geospatial API timeout, falling back to relative positioning.");

            HideLoading();
            noroshiARManager.enabled = true;
            _isReady = true;
        }

        private void ShowLoading(string message)
        {
            if (loadingPanel != null) loadingPanel.SetActive(true);
            if (statusText   != null) statusText.text = message;
        }

        private void HideLoading()
        {
            if (loadingPanel != null) loadingPanel.SetActive(false);
        }

        public void OnBackButtonPressed()
        {
            UnityEngine.SceneManagement.SceneManager.LoadScene("MainScene");
        }
    }
}
