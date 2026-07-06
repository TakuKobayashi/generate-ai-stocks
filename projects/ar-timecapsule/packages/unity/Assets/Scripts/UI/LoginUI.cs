using Cysharp.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ARTimeCapsule.Api;

namespace ARTimeCapsule.UI
{
    public class LoginUI : MonoBehaviour
    {
        [SerializeField] private TMP_InputField _emailField;
        [SerializeField] private TMP_InputField _passwordField;
        [SerializeField] private Button         _loginButton;
        [SerializeField] private TMP_Text       _errorText;
        [SerializeField] private GameObject     _loadingOverlay;

        private void Start()
        {
            _loginButton.onClick.AddListener(() => LoginAsync().Forget());
            _errorText.text = "";
        }

        private async UniTaskVoid LoginAsync()
        {
            var email = _emailField.text.Trim();
            var pass  = _passwordField.text;
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(pass))
            { _errorText.text = "メールアドレスとパスワードを入力してください"; return; }

            _loadingOverlay.SetActive(true);
            _loginButton.interactable = false;
            _errorText.text = "";

            var res = await ApiClient.Instance.LoginAsync(email, pass, this.GetCancellationTokenOnDestroy());

            _loadingOverlay.SetActive(false);
            _loginButton.interactable = true;

            if (res.Success) { gameObject.SetActive(false); }
            else { _errorText.text = res.Error?.Message ?? "ログインに失敗しました"; }
        }
    }
}
