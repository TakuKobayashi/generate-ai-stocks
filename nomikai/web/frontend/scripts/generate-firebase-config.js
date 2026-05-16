#!/usr/bin/env node
/**
 * ビルド時に public/firebase-config.js を生成するスクリプト。
 * Service Worker 内では process.env が使えないため、
 * 設定を window.__FIREBASE_CONFIG__ に埋め込んだ JS ファイルを生成する。
 *
 * 使い方: node scripts/generate-firebase-config.js
 * package.json の prebuild フックで自動実行する。
 */

const fs = require('fs');
const path = require('path');

const config = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            || '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             || '',
};

const content = `// 自動生成ファイル - 編集しないでください
// generate-firebase-config.js によって生成されます
self.__FIREBASE_CONFIG__ = ${JSON.stringify(config, null, 2)};
`;

const outPath = path.join(__dirname, '../public/firebase-config.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('[generate-firebase-config] 生成完了:', outPath);
