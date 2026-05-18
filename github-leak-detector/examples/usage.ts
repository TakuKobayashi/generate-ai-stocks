// 使用例: プログラムから使用する場合

import { LeakDetector } from './src/detector';

async function example() {
  // 基本的な使用例
  console.log('Example 1: Basic detection');
  const detector1 = new LeakDetector();
  const leaks1 = await detector1.detect();
  console.log(`Found ${leaks1.length} leaks\n`);

  // カスタムパターンを使用
  console.log('Example 2: Custom patterns');
  const detector2 = new LeakDetector({
    searchPatterns: ['MyUniqueClassName', 'mySpecialFunction'],
    excludeForks: true,
    maxResults: 10
  });
  const leaks2 = await detector2.detect();
  console.log(`Found ${leaks2.length} leaks\n`);

  // 通知付き
  console.log('Example 3: With Slack notification');
  const detector3 = new LeakDetector({
    notify: true,
    notificationUrl: process.env.SLACK_WEBHOOK_URL,
    notificationType: 'slack',
    notificationMessage: '⚠️ ソースコードの流出が検出されました',
    apiToken: process.env.GITHUB_TOKEN
  });
  const leaks3 = await detector3.detect();
  console.log(`Found ${leaks3.length} leaks\n`);

  // JSON出力
  console.log('Example 4: JSON output');
  const detector4 = new LeakDetector();
  const jsonOutput = await detector4.detectAndOutputJson();
  console.log(jsonOutput);
}

// 実行
if (require.main === module) {
  example().catch(console.error);
}

export { example };
