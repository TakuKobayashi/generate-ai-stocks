// Assets/ARRecorder/Core/EditorARSimulator.cs
// Unity エディター上で Play ボタンを押したときに
// 実機 AR カメラの代わりに使われるシミュレーター。
// ARFoundation の XR Simulation 機能が使えない環境向けのフォールバック。

using UnityEngine;

namespace ARRecorder.Core
{
    /// <summary>
    /// エディター再生時に AR カメラの代替として動作するシミュレーター。
    /// <para>実機では何もしない（<c>#if UNITY_EDITOR</c> で無効化）。</para>
    /// </summary>
    public class EditorARSimulator : MonoBehaviour
    {
#if UNITY_EDITOR
        [Header("Simulator Settings")]
        [Tooltip("エディター上でカメラに表示する背景色（カメラ映像の代替）")]
        [SerializeField] private Color simulatedBackgroundColor = new Color(0.1f, 0.15f, 0.2f);

        [Tooltip("シミュレーター用サンプル AR オブジェクトを生成するか")]
        [SerializeField] private bool spawnSampleObjects = true;

        [Tooltip("サンプルキューブの数")]
        [SerializeField] private int sampleCubeCount = 3;

        private Camera cam;

        private void Awake()
        {
            cam = GetComponent<Camera>();
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = simulatedBackgroundColor;
            }
        }

        private void Start()
        {
            if (spawnSampleObjects)
                SpawnSampleARObjects();
        }

        private void SpawnSampleARObjects()
        {
            float spread = 1.5f;
            Color[] colors = { Color.red, Color.green, Color.cyan };

            for (int i = 0; i < sampleCubeCount; i++)
            {
                var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                cube.name = $"SimulatedARObject_{i}";
                cube.transform.localScale = Vector3.one * 0.15f;
                cube.transform.position = new Vector3(
                    Mathf.Sin(i * Mathf.PI * 2f / sampleCubeCount) * spread,
                    0f,
                    2f + Mathf.Cos(i * Mathf.PI * 2f / sampleCubeCount) * spread);

                var renderer = cube.GetComponent<Renderer>();
                var mat = new Material(Shader.Find("Standard"));
                mat.color = colors[i % colors.Length];
                renderer.material = mat;

                // ゆっくり回転させる
                cube.AddComponent<SampleRotator>();
            }

            Debug.Log($"[EditorARSimulator] Spawned {sampleCubeCount} sample AR objects");
        }

        // ---- 簡易マウス操作でカメラを動かす ----
        private float yaw, pitch;

        private void Update()
        {
            // 右クリック + ドラッグでカメラ回転
            if (Input.GetMouseButton(1))
            {
                yaw   += Input.GetAxis("Mouse X") * 2f;
                pitch -= Input.GetAxis("Mouse Y") * 2f;
                pitch  = Mathf.Clamp(pitch, -80f, 80f);
                transform.localEulerAngles = new Vector3(pitch, yaw, 0f);
            }

            // WASD でカメラ移動
            float speed = Input.GetKey(KeyCode.LeftShift) ? 3f : 1f;
            transform.Translate(new Vector3(
                Input.GetAxis("Horizontal"),
                0f,
                Input.GetAxis("Vertical")) * Time.deltaTime * speed);
        }
#endif
    }

#if UNITY_EDITOR
    /// <summary>シミュレーター用サンプルオブジェクトをゆっくり回転させる</summary>
    public class SampleRotator : MonoBehaviour
    {
        private void Update() =>
            transform.Rotate(Vector3.up * 30f * Time.deltaTime);
    }
#endif
}
