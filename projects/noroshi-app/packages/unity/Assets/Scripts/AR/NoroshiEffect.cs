using UnityEngine;
using Noroshi.Models;

namespace Noroshi.AR
{
    /// <summary>
    /// 狼煙Prefabにアタッチ: パーティクルエフェクト・InfoUI制御
    /// </summary>
    [RequireComponent(typeof(ParticleSystem))]
    public class NoroshiEffect : MonoBehaviour
    {
        [Header("Particle Systems")]
        [SerializeField] private ParticleSystem smokeParticle;   // 煙
        [SerializeField] private ParticleSystem fireParticle;    // 炎
        [SerializeField] private ParticleSystem emberParticle;   // 火の粉

        [Header("Info UI")]
        [SerializeField] private GameObject infoBillboard;       // 住所・メッセージ表示
        [SerializeField] private TMPro.TextMeshPro addressText;
        [SerializeField] private TMPro.TextMeshPro messageText;

        [Header("Light")]
        [SerializeField] private Light fireLight;

        private NoroshiModel _model;
        private float _lightBaseIntensity = 2f;
        private float _lightFlickerSpeed  = 8f;

        // ─── Initialize ──────────────────────────────────────────────────

        public void Initialize(NoroshiModel model)
        {
            _model = model;

            if (addressText != null) addressText.text = model.address;
            if (messageText  != null) messageText.text  = string.IsNullOrEmpty(model.message) ? "" : $"「{model.message}」";

            // Info Billboardは常にカメラに向く
            if (infoBillboard != null) infoBillboard.SetActive(true);

            PlayEffects();
        }

        // ─── Lifecycle ────────────────────────────────────────────────────

        private void Update()
        {
            // ライトのちらつき
            if (fireLight != null)
            {
                fireLight.intensity = _lightBaseIntensity
                    + Mathf.Sin(Time.time * _lightFlickerSpeed) * 0.4f
                    + Mathf.Sin(Time.time * _lightFlickerSpeed * 2.3f) * 0.2f;
            }

            // Billboard をカメラに向ける
            if (infoBillboard != null && Camera.main != null)
            {
                infoBillboard.transform.LookAt(Camera.main.transform);
                infoBillboard.transform.Rotate(0, 180, 0);
            }
        }

        // ─── Effects ──────────────────────────────────────────────────────

        private void PlayEffects()
        {
            if (smokeParticle != null && !smokeParticle.isPlaying) smokeParticle.Play();
            if (fireParticle  != null && !fireParticle.isPlaying)  fireParticle.Play();
            if (emberParticle != null && !emberParticle.isPlaying) emberParticle.Play();
        }

        public void StopEffects()
        {
            if (smokeParticle != null) smokeParticle.Stop();
            if (fireParticle  != null) fireParticle.Stop();
            if (emberParticle != null) emberParticle.Stop();
        }

        /// <summary>距離に応じてエフェクト強度を調整</summary>
        public void SetIntensity(float normalizedDistance)
        {
            // 0=最近傍, 1=1km
            float rate = 1f - normalizedDistance;

            if (smokeParticle != null)
            {
                var emission = smokeParticle.emission;
                emission.rateOverTime = Mathf.Lerp(5f, 80f, rate);
                var main = smokeParticle.main;
                main.startSize = new ParticleSystem.MinMaxCurve(
                    Mathf.Lerp(0.5f, 3f, rate),
                    Mathf.Lerp(1f, 6f, rate));
            }

            if (fireParticle != null)
            {
                var emission = fireParticle.emission;
                emission.rateOverTime = Mathf.Lerp(10f, 120f, rate);
            }

            if (fireLight != null)
                _lightBaseIntensity = Mathf.Lerp(0.5f, 4f, rate);
        }
    }
}
