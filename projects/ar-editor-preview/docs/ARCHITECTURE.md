# アーキテクチャ設計書 — 責務分割

## レイヤー構成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MONOREPO ROOT                                     │
│                                                                             │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐ │
│  │   proto/         │   │   gen/            │   │   tools/                 │ │
│  │  (Source of      │──►│  (Generated code) │   │  (codegen scripts)       │ │
│  │   Truth)         │   │  csharp/          │   │  proto-gen.sh            │ │
│  │  *.proto         │   │  kotlin/          │   │  token-gen/              │ │
│  └─────────────────┘   │  swift/           │   └──────────────────────────┘ │
│                         └──────────────────┘                                │
│                                  │                                          │
│           ┌──────────────────────┼──────────────────────┐                  │
│           ▼                      ▼                       ▼                  │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────────┐    │
│  │ packages/unity │   │  apps/android    │   │    apps/ios            │    │
│  │                │   │                  │   │                        │    │
│  │ Unity Package  │   │ Android ARCore   │   │  iOS ARKit             │    │
│  │ (Subscriber)   │   │ Companion App    │   │  Companion App         │    │
│  │                │   │ (Publisher)      │   │  (Publisher)           │    │
│  └────────────────┘   └──────────────────┘   └────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 各層の責務

### `proto/` — 共有プロトコル定義 (Source of Truth)
- **責務**: プラットフォーム非依存の通信フォーマット定義のみ
- **技術**: Protocol Buffers v3
- **ルール**: ここを変更したら必ず `gen/` を再生成してコミットする
- **禁止**: ビジネスロジック、プラットフォーム固有の型

### `gen/` — 生成コード (コミット対象)
- **責務**: proto から自動生成されたコードの配布
- **ルール**: 手動編集禁止。`tools/proto-gen.sh` で一括再生成
- **利点**: CI で protoc 環境不要。各アプリがそのまま参照可能

### `packages/unity/` — Unity Package
| サブ層 | 責務 |
|--------|------|
| `Runtime/Core/` | AR データ型ラッパー、Manager、Settings ScriptableObject |
| `Runtime/Transport/` | LiveKit 接続・送受信の抽象層 (`IARTransport` インターフェース) |
| `Runtime/Subsystems/` | XRLoader + 3つのサブシステム実装 (Session/Camera/Plane) |
| `Editor/` | Editor Window UI、Play時自動セットアップ、ビルドフック |
| `Tests/` | Runtime/Editor それぞれのユニットテスト |

**禁止**: Android/iOS 固有コード、ARCore/ARKit SDK への直接依存

### `apps/android/` — Android Companion App
| サブ層 | 責務 |
|--------|------|
| `ar/` | ARCore セッション管理、フレームデータ取得 |
| `transport/` | LiveKit Publisher、proto エンコード、Video Track送信 |
| `ui/` | 接続設定 UI、ステータス表示 |
| `proto/` | gen/ からコピーされた生成コード |

**禁止**: Unity 固有の型、Editor への直接依存

### `apps/ios/` — iOS Companion App
| サブ層 | 責務 |
|--------|------|
| `AR/` | ARKit セッション管理、フレームデータ取得 |
| `Transport/` | LiveKit Publisher、proto エンコード、Video Track送信 |
| `UI/` | SwiftUI 接続設定画面 |
| `Proto/` | gen/ からコピーされた生成コード |

**禁止**: Android 固有コード、Unity 固有の型

---

## データフロー

```
Device (ARCore/ARKit)
  │
  ├─ Video Track ──────────────────────────────────────────────────────┐
  │   H.264/VP8, ~30fps, 720p                                         │
  │                                                                    │
  └─ Data Channel (Reliable) ──────────────────────────────────────────┤
      Protobuf binary                                                  │
      • ARFrame (pose + light + intrinsics, 毎フレーム)               │
      • ARPlanes (差分更新)                                            │
      • SessionState (状態変化時のみ)                                  │
                                                                       ▼
                                                             LiveKit Server
                                                             (Docker / LAN)
                                                                       │
                                                                       ▼
                                                             Unity Editor
                                                               │
                                                               ├─ CameraSubsystem
                                                               │   → ARCameraManager へ注入
                                                               │
                                                               ├─ SessionSubsystem
                                                               │   → ARSession へ注入
                                                               │
                                                               └─ PlaneSubsystem
                                                                   → ARPlaneManager へ注入
```

## 将来の拡張ポイント

```
packages/unity/Runtime/Subsystems/
  EditorPreviewSessionSubsystem.cs     ← 実装済み
  EditorPreviewCameraSubsystem.cs      ← 実装済み
  EditorPreviewPlaneSubsystem.cs       ← 実装済み
  EditorPreviewDepthSubsystem.cs       ← 将来: 深度マップ
  EditorPreviewMeshSubsystem.cs        ← 将来: ARMeshManager
  EditorPreviewAnchorSubsystem.cs      ← 将来: ARAnchorManager
  EditorPreviewBodySubsystem.cs        ← 将来: ARHumanBodyManager (iOS)
  EditorPreviewObjectSubsystem.cs      ← 将来: ARTrackedObjectManager
```

## CI 戦略

```
┌─ proto 変更 ──────► proto-gen-check (生成コードの差分チェック)
│
├─ packages/unity 変更 ──► unity-test (Unity Test Runner)
│                      └─► upm-pack (UPM パッケージ検証)
│
├─ apps/android 変更 ──► android-build (Gradle assembleRelease)
│                    └─► android-test
│
└─ apps/ios 変更 ──────► ios-build (xcodebuild)
                     └─► ios-test
```
