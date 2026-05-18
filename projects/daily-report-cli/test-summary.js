#!/usr/bin/env node

/**
 * 要約機能のテストスクリプト
 * 
 * 使用方法:
 * node test-summary.js
 */

const { LocalSummarizer } = require('./dist/services/summarizer/local-summarizer');

// テストデータ
const testData = {
  date: '2024-02-06',
  git: {
    commits: [
      { message: 'feat: ユーザー認証機能を実装', date: new Date(), branch: 'feature/auth', repository: 'my-app', hash: 'abc123' },
      { message: 'fix: データベース接続のバグを修正', date: new Date(), branch: 'main', repository: 'my-app', hash: 'def456' },
      { message: 'refactor: APIエンドポイントをリファクタリング', date: new Date(), branch: 'refactor/api', repository: 'my-app', hash: 'ghi789' },
    ]
  },
  github: {
    commits: [
      { message: 'feat: パフォーマンス最適化を実装', date: new Date(), branch: 'main', branchUrl: '', repository: 'my-app', repositoryUrl: '', hash: 'jkl012', commitUrl: '' },
      { message: 'docs: READMEを更新', date: new Date(), branch: 'main', branchUrl: '', repository: 'my-app', repositoryUrl: '', hash: 'mno345', commitUrl: '' },
    ],
    prComments: [
      { prTitle: 'Add new feature', prUrl: '', comment: 'LGTMです。素晴らしい実装ですね!', commentUrl: '', date: new Date() },
    ]
  },
  asana: {
    completedTasks: [
      { title: 'ユーザー登録機能の実装', url: '', completedAt: new Date() },
      { title: 'セキュリティ監査の対応', url: '', completedAt: new Date() },
    ],
    createdTasks: [
      { title: 'パフォーマンステストの実施', url: '', createdAt: new Date() },
    ],
    comments: []
  },
  googleTasks: {
    completedTasks: [],
    createdTasks: []
  },
  trello: {
    completedTasks: [],
    createdTasks: [],
    comments: []
  }
};

console.log('=== ローカル要約機能テスト ===\n');

try {
  const summarizer = new LocalSummarizer();
  const result = summarizer.summarize(testData);
  
  console.log('📊 統計情報:');
  console.log(`  - 総コミット数: ${result.stats.totalCommits}`);
  console.log(`  - PRコメント数: ${result.stats.totalPRComments}`);
  console.log(`  - 完了タスク数: ${result.stats.totalCompletedTasks}`);
  console.log(`  - 新規タスク数: ${result.stats.totalCreatedTasks}`);
  
  console.log('\n📝 3行要約:');
  result.threeLineSummary.forEach((line, i) => {
    if (line) {
      console.log(`  ${i + 1}. ${line}`);
    }
  });
  
  // キーワード抽出
  const sentences = [
    ...testData.git.commits.map(c => c.message),
    ...testData.github.commits.map(c => c.message),
  ];
  const keywords = summarizer.extractKeywords(sentences, 5);
  
  console.log('\n🔑 キーワード:');
  console.log(`  ${keywords.join(', ')}`);
  
  console.log('\n✅ テスト完了!');
  
} catch (error) {
  console.error('❌ エラー:', error);
  process.exit(1);
}
