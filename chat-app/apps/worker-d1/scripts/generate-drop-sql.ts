import fs from 'fs';
import path from 'path';
// schema.ts からすべてのエクスポートをインポート
import * as schema from '../src/db/schema'; 

function generateDropSql() {
  const tableNames: string[] = [];

  // スキーマオブジェクトからテーブル名を抽出
  for (const [key, value] of Object.entries(schema)) {
    // Drizzleのテーブルオブジェクト（Symbol(drizzle:Name)等を持つ）かチェック
    if (value && typeof value === 'object' && 'id' in value === false) {
      // Drizzleの内部プロパティから実際のテーブル名を取得
      const tableName = (value as any)[Symbol.for('drizzle:Name')];
      if (tableName) {
        tableNames.push(tableName);
      }
    }
  }

  // 重複排除
  const uniqueTables = Array.from(new Set(tableNames));

  // SQLの組み立て
  const sqlLines = [
    '-- Auto-generated Drop Table Script for Cloudflare D1',
    '--',
    '-- マイグレーション管理テーブルリセット',
    'DELETE FROM d1_migrations;',
    '',
    '-- 一時的に外部キー制約を無効化して、順序に関係なく安全に削除できるようにする',
    'PRAGMA foreign_keys = OFF;',
    ''
  ];

  // 各テーブルの DROP 文を追加
  uniqueTables.forEach((table) => {
    sqlLines.push(`DROP TABLE IF EXISTS ${table};`);
  });

  sqlLines.push('', 'PRAGMA foreign_keys = ON;');

  const outputPath = path.join(__dirname, '..' , 'seeds', 'drop_tables.sql');
  fs.writeFileSync(outputPath, sqlLines.join('\n'), 'utf8');
  
  console.log(`✅ ${outputPath} が正常に生成されました。`);
  console.log(`対象テーブル: ${uniqueTables.join(', ')}`);
}

generateDropSql();