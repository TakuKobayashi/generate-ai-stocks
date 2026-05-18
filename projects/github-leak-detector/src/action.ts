import * as core from '@actions/core';
import { LeakDetector } from './detector';
import { DetectionOptions } from './types';

async function run(): Promise<void> {
  try {
    // 入力パラメータを取得
    const excludeForks = core.getInput('exclude-forks') === 'true';
    const notify = core.getInput('notify') === 'true';
    const notificationUrl = core.getInput('notification-url');
    const notificationType = core.getInput('notification-type') as 'slack' | 'webhook' | 'email';
    const notificationMessage = core.getInput('notification-message');
    const apiToken = core.getInput('api-token') || process.env.GITHUB_TOKEN;
    const patternsInput = core.getInput('patterns');
    const maxResults = parseInt(core.getInput('max-results') || '50', 10);

    const patterns = patternsInput ? patternsInput.split(',').map(p => p.trim()) : undefined;

    const options: DetectionOptions = {
      excludeForks,
      notify,
      notificationUrl,
      notificationType,
      notificationMessage,
      apiToken,
      searchPatterns: patterns,
      maxResults
    };

    // 検出を実行
    const detector = new LeakDetector(options);
    const leaks = await detector.detect();

    // 出力を設定
    core.setOutput('leaks-found', leaks.length);
    core.setOutput('results-json', JSON.stringify(leaks));

    // 流出が検出された場合は警告
    if (leaks.length > 0) {
      core.warning(`Found ${leaks.length} potential leak(s)`);
    } else {
      core.info('No leaks detected');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();
