using UnityEngine;

/// <summary>
/// 射撃エフェクト管理 (Unity 6)
/// ローカル射撃・ネットワーク経由の射撃どちらにも対応
/// </summary>
public class BulletEffectManager : MonoBehaviour
{
    public static BulletEffectManager Instance { get; private set; }

    [Header("エフェクト")]
    public GameObject muzzleFlashPrefab;
    public GameObject bulletTracerPrefab;
    public GameObject bulletHitPrefab;
    public AudioClip  shotSound;
    public AudioClip  missSound;

    [Header("スナイパーの銃口（自分）")]
    public Transform localMuzzlePoint;

    AudioSource _audio;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        _audio = GetComponent<AudioSource>();
    }

    /// <summary>射撃エフェクト再生（NetworkGameSyncから呼ばれる）</summary>
    public void PlayShotEffect(
        Vector3  origin,
        Vector3  direction,
        bool     hit,
        Vector3? hitPoint)
    {
        // 銃声
        if (_audio && shotSound)
            _audio.PlayOneShot(hit ? shotSound : missSound);

        // 着弾エフェクト
        if (hit && hitPoint.HasValue && bulletHitPrefab)
        {
            var fx = Instantiate(bulletHitPrefab, hitPoint.Value, Quaternion.LookRotation(-direction));
            Destroy(fx, 2f);
        }

        // トレーサー（弾道線）
        if (bulletTracerPrefab)
        {
            var end  = hitPoint ?? origin + direction * 500f;
            var line = Instantiate(bulletTracerPrefab, origin, Quaternion.identity);
            if (line.TryGetComponent<LineRenderer>(out var lr))
            {
                lr.SetPosition(0, origin);
                lr.SetPosition(1, end);
            }
            Destroy(line, 0.3f);
        }
    }
}
