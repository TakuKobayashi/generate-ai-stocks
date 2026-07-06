using System.Threading;
using Cysharp.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace ARTimeCapsule.Audio
{
    [RequireComponent(typeof(AudioSource))]
    public class SpatialAudioPlayer : MonoBehaviour
    {
        [SerializeField] private float _maxDistance   = 50f;
        [SerializeField] private float _minDistance   = 1f;
        [SerializeField] private float _fadeInDuration = 1.5f;

        private AudioSource _source;

        private void Awake()
        {
            _source             = GetComponent<AudioSource>();
            _source.spatialBlend = 1.0f;
            _source.rolloffMode  = AudioRolloffMode.Logarithmic;
            _source.maxDistance  = _maxDistance;
            _source.minDistance  = _minDistance;
            _source.playOnAwake  = false;
            _source.volume       = 0f;
        }

        public async UniTaskVoid LoadAndPlay(string url, bool loop = false, CancellationToken ct = default)
        {
            var audioType = url.Contains(".ogg") ? AudioType.OGGVORBIS
                          : url.Contains(".wav") ? AudioType.WAV
                          : AudioType.MPEG;

            using var req = UnityWebRequestMultimedia.GetAudioClip(url, audioType);
            await req.SendWebRequest().ToUniTask(cancellationToken: ct);

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[SpatialAudioPlayer] Load failed: {req.error}");
                return;
            }

            _source.clip = DownloadHandlerAudioClip.GetContent(req);
            _source.loop = loop;
            _source.Play();

            // フェードイン
            float elapsed = 0f;
            while (elapsed < _fadeInDuration && !ct.IsCancellationRequested)
            {
                elapsed      += Time.deltaTime;
                _source.volume = Mathf.Clamp01(elapsed / _fadeInDuration);
                await UniTask.Yield(PlayerLoopTiming.Update, ct);
            }
            if (!ct.IsCancellationRequested) _source.volume = 1f;
        }

        public void Stop()
        {
            if (_source.isPlaying) _source.Stop();
        }
    }
}
