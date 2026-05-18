#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
#  NomikaiApp iOS セットアップスクリプト
#  実行: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "🍺 飲みに行きたい！iOS セットアップ"
echo "=================================="

# 1. XcodeGen でプロジェクト生成
if ! command -v xcodegen &>/dev/null; then
  echo "📦 XcodeGen をインストール中..."
  if command -v brew &>/dev/null; then
    brew install xcodegen
  else
    echo "❌ Homebrew が必要です: https://brew.sh"
    exit 1
  fi
fi

echo "🔧 Xcode プロジェクトを生成中..."
xcodegen generate

# 2. CocoaPods インストール
if ! command -v pod &>/dev/null; then
  echo "📦 CocoaPods をインストール中..."
  sudo gem install cocoapods
fi

echo "📦 CocoaPods 依存関係をインストール中..."
pod install

# 3. GoogleService-Info.plist の確認
GOOGLE_PLIST="NomikaiApp/Resources/GoogleService-Info.plist"
if [ ! -f "$GOOGLE_PLIST" ]; then
  echo ""
  echo "⚠️  GoogleService-Info.plist が見つかりません"
  echo "   Firebase Console から iOS アプリを追加してダウンロードし、"
  echo "   NomikaiApp/Resources/ に配置してください。"
  echo "   https://console.firebase.google.com"
fi

# 4. Info.plist の設定確認
echo ""
echo "✅ セットアップ完了！"
echo ""
echo "次のステップ:"
echo "  1. NomikaiApp/Resources/GoogleService-Info.plist を配置"
echo "  2. NomikaiApp/Resources/Info.plist の以下を編集:"
echo "     - GMSApiKey: Google Maps APIキー"
echo "     - API_BASE_URL: Cloudflare Workers の URL"
echo "  3. project.yml の DEVELOPMENT_TEAM を設定"
echo "  4. Xcode で NomikaiApp.xcworkspace を開く:"
echo "     open NomikaiApp.xcworkspace"
echo "  5. Signing & Capabilities で 'Push Notifications' を追加"
echo "  6. 実機でビルド・実行"
echo ""
echo "  ※ プッシュ通知のテストには実機が必要です"
