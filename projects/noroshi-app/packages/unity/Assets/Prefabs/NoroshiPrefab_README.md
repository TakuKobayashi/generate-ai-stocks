# Noroshi Prefab セットアップガイド

## Prefab 構成

```
NoroshiPrefab (GameObject)
├── NoroshiEffect.cs (コンポーネント)
├── SmokeParticle (ParticleSystem)
│   └── 煙エフェクト設定 ↓
├── FireParticle (ParticleSystem)
│   └── 炎エフェクト設定 ↓
├── EmberParticle (ParticleSystem)
│   └── 火の粉エフェクト設定 ↓
├── FireLight (Light)
│   └── Type: Point, Color: #FF6600, Intensity: 2
├── 3DModel (あなたが用意するFBX/GLTFモデル)
│   └── Meshes/noroshi_base など
└── InfoBillboard (Canvas - World Space)
    ├── AddressText (TextMeshPro)
    └── MessageText (TextMeshPro)
```

## ParticleSystem 推奨設定

### SmokeParticle (煙)
| プロパティ          | 値                        |
|---------------------|---------------------------|
| Start Lifetime      | 5 ~ 10                    |
| Start Speed         | 2 ~ 4                     |
| Start Size          | 1 ~ 3                     |
| Start Color         | #888888 → #444444 (グラデ) |
| Emission Rate       | 20                        |
| Shape               | Cone, Angle: 15           |
| Color over Lifetime | α: 100% → 0%              |
| Size over Lifetime  | 1 → 3 (拡大)              |
| Renderer Material   | Smoke_Additive            |

### FireParticle (炎)
| プロパティ          | 値                        |
|---------------------|---------------------------|
| Start Lifetime      | 0.5 ~ 1.5                 |
| Start Speed         | 3 ~ 6                     |
| Start Size          | 0.5 ~ 1.5                 |
| Start Color         | #FF4400 → #FFAA00         |
| Emission Rate       | 60                        |
| Shape               | Cone, Angle: 10           |
| Color over Lifetime | 炎色グラデーション         |
| Renderer Material   | Fire_Additive             |

### EmberParticle (火の粉)
| プロパティ          | 値                        |
|---------------------|---------------------------|
| Start Lifetime      | 2 ~ 4                     |
| Start Speed         | 2 ~ 8                     |
| Start Size          | 0.05 ~ 0.15               |
| Start Color         | #FFFF00                   |
| Emission Rate       | 15                        |
| Gravity Modifier    | -0.1                      |
| Renderer Material   | Ember_Additive            |

## InfoBillboard 設定

- Canvas Render Mode: World Space
- Canvas Scale: (0.01, 0.01, 0.01) → 1cm単位で読みやすいサイズに
- AddressText: Font Size 3, Color White
- MessageText: Font Size 2.5, Color #FFCC00
- Background: 半透明の黒パネル（Image, Alpha: 0.7）

## 3Dモデル配置

`Assets/Models/` に以下を配置してください:
- `noroshi_base.fbx` (のろし台の3Dモデル)
- `noroshi_fire.fbx` (オプション: 炎の静的メッシュ)

モデルがない場合は暫定として Cylinder + Cone で代替可能:
```
TempBase (Cylinder)
  scale: (0.3, 1.5, 0.3)
  material: Stone_Material

TempTop (Cone / Cylinder)
  scale: (0.4, 0.3, 0.4)
  position: (0, 1.65, 0)
  material: Wood_Material
```

## ARシーン構成

```
ARScene
├── AR Session Origin
│   ├── AR Camera
│   │   └── AR Camera Manager
│   │   └── AR Camera Background
│   └── AR Geospatial Creator Origin (ARCore Extensions)
├── AR Session
├── AR Earth Manager (ARCore Extensions)
├── ARAnchorManager
├── NoroshiARManager.cs ← すべての狼煙オブジェクトを管理
├── ARSceneController.cs ← 初期化・UI制御
└── UI (Canvas - Screen Space Overlay)
    ├── LoadingPanel
    ├── StatusText
    ├── NoLocationPanel
    └── BackButton
```

## Package Manager 依存関係

Unity Package Manager に以下を追加してください:

```json
{
  "dependencies": {
    "com.unity.xr.arfoundation": "6.0.0",
    "com.unity.xr.arcore": "6.0.0",
    "com.unity.xr.arkit": "6.0.0",
    "com.google.ar.core.arcore-extensions": "1.44.0",
    "com.google.firebase.messaging": "12.4.0",
    "com.google.firebase.app": "12.4.0"
  }
}
```

## UniWebView

地図表示には UniWebView (有料アセット) を使用します:
https://uniwebview.com/

代替として無料の `gree/unity-webview` も使用可能ですが、機能が限定的です。
