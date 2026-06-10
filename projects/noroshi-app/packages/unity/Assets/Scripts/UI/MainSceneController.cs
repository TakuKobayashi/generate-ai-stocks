using UnityEngine;
using UnityEngine.SceneManagement;
using Noroshi.Database;
using Noroshi.Utils;

namespace Noroshi.UI
{
    /// <summary>
    /// メイン画面: 「狼煙を確認する」「狼煙を上げる」ボタン
    /// </summary>
    public class MainSceneController : MonoBehaviour
    {
        [Header("UI")]
        [SerializeField] private GameObject loadingOverlay;
        [SerializeField] private TMPro.TextMeshProUGUI loadingText;

        private void Start()
        {
            // 起動時: サーバーから周辺狼煙を取得してローカルDBに保存
            StartCoroutine(InitialFetch());
        }

        private System.Collections.IEnumerator InitialFetch()
        {
            ShowLoading("周辺の狼煙情報を取得中...");

            // 位置情報待ち (最大10秒)
            float t = 10f;
            while (!AppManager.Instance.HasLocation && t > 0)
            {
                yield return new WaitForSeconds(0.5f);
                t -= 0.5f;
            }

            if (AppManager.Instance.HasLocation)
            {
                var fetchTask = AppManager.Instance.ApiClient.FetchNearbyNoroshis(
                    AppManager.Instance.CurrentLatitude,
                    AppManager.Instance.CurrentLongitude
                );
                yield return new WaitUntil(() => fetchTask.IsCompleted);

                if (fetchTask.Result != null && fetchTask.Result.Length > 0)
                    NoroshiRecord.SaveAll(fetchTask.Result);

                // 期限切れ削除
                NoroshiRecord.DeleteExpired();
            }

            HideLoading();
        }

        // ─── Button Handlers ──────────────────────────────────────────────

        public void OnViewNoroshiPressed()
        {
            SceneManager.LoadScene("ARScene");
        }

        public void OnCreateNoroshiPressed()
        {
            SceneManager.LoadScene("CreateNoroshiScene");
        }

        // ─── Loading ──────────────────────────────────────────────────────

        private void ShowLoading(string message)
        {
            if (loadingOverlay != null) loadingOverlay.SetActive(true);
            if (loadingText    != null) loadingText.text = message;
        }

        private void HideLoading()
        {
            if (loadingOverlay != null) loadingOverlay.SetActive(false);
        }
    }
}
