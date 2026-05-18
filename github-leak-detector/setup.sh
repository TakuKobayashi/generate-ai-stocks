#!/bin/bash

# GitHub Leak Detector セットアップスクリプト

set -e

echo "🔧 GitHub Leak Detector セットアップを開始します..."

# Node.jsのバージョン確認
echo ""
echo "📦 Node.jsのバージョンを確認中..."
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" == "not found" ]]; then
    echo "❌ Node.jsがインストールされていません"
    echo "   Node.js 16以上をインストールしてください: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $NODE_VERSION が見つかりました"

# 依存関係のインストール
echo ""
echo "📦 依存関係をインストール中..."
npm install

# ビルド
echo ""
echo "🔨 TypeScriptをビルド中..."
npm run build

echo ""
echo "✅ セットアップが完了しました！"
echo ""
echo "使い方:"
echo "  npm start -- detect                        # 検出を実行"
echo "  npm run dev -- detect                      # 開発モードで実行"
echo "  node dist/cli.js detect --help             # ヘルプを表示"
echo ""
echo "グローバルにインストールする場合:"
echo "  npm install -g ."
echo "  github-leak-detector detect"
echo ""
