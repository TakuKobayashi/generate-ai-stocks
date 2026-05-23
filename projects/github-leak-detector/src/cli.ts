#!/usr/bin/env node

import { Command } from 'commander';
import { LeakDetector } from './detector';
import { DetectionOptions } from './types';
import chalk from 'chalk';

const program = new Command();

program
  .name('github-leak-detector')
  .description('CLI tool to detect source code leaks on GitHub')
  .version('1.0.0');

program
  .command('detect')
  .description('Detect potential source code leaks on GitHub')
  .option('--no-exclude-forks', 'Include forked repositories in the search')
  .option('--notify', 'Send notification when leaks are detected')
  .option('--notification-url <url>', 'URL for sending notifications (Slack webhook or custom webhook)')
  .option('--notification-type <type>', 'Notification type: slack, webhook, email', 'slack')
  .option('--notification-message <message>', 'Custom notification message')
  .option('--api-token <token>', 'GitHub API token (optional, increases rate limit)')
  .option('--patterns <patterns>', 'Comma-separated search patterns (optional, auto-detected if not provided)')
  .option('--max-results <number>', 'Maximum number of results to return', '50')
  .option('--search-method <method>', 'Search method: blob-hash (default, most accurate), pattern, or hybrid', 'blob-hash')
  .option('--max-blob-hashes <number>', 'Maximum number of blob hashes to search', '50')
  .option('--blob-batch-size <number>', 'Number of blob hashes per batch', '20')
  .option('--match-threshold <percent>', 'Minimum match percentage to report (0-100)', '30')
  .option('--high-match-threshold <percent>', 'High risk threshold percentage (0-100)', '80')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    try {
      const detectionOptions: DetectionOptions = {
        excludeForks: options.excludeForks !== false,
        notify: options.notify || false,
        notificationUrl: options.notificationUrl,
        notificationType: options.notificationType as 'slack' | 'webhook' | 'email',
        notificationMessage: options.notificationMessage,
        apiToken: options.apiToken || process.env.GITHUB_TOKEN,
        searchPatterns: options.patterns ? options.patterns.split(',').map((p: string) => p.trim()) : undefined,
        maxResults: parseInt(options.maxResults, 10),
        searchMethod: options.searchMethod as 'blob-hash' | 'pattern' | 'hybrid',
        maxBlobHashesToSearch: parseInt(options.maxBlobHashes, 10),
        blobHashBatchSize: parseInt(options.blobBatchSize, 10),
        matchThresholdPercent: parseFloat(options.matchThreshold),
        highMatchThresholdPercent: parseFloat(options.highMatchThreshold)
      };

      // 通知設定のバリデーション
      if (detectionOptions.notify && !detectionOptions.notificationUrl) {
        console.error(chalk.red('Error: --notification-url is required when --notify is enabled'));
        process.exit(1);
      }

      // 閾値のバリデーション
      if (detectionOptions.matchThresholdPercent! < 0 || detectionOptions.matchThresholdPercent! > 100) {
        console.error(chalk.red('Error: --match-threshold must be between 0 and 100'));
        process.exit(1);
      }

      if (detectionOptions.highMatchThresholdPercent! < 0 || detectionOptions.highMatchThresholdPercent! > 100) {
        console.error(chalk.red('Error: --high-match-threshold must be between 0 and 100'));
        process.exit(1);
      }

      const detector = new LeakDetector(detectionOptions);

      if (options.json) {
        const jsonResult = await detector.detectAndOutputJson();
        console.log(jsonResult);
      } else {
        await detector.detect();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('schedule')
  .description('Run leak detection on a schedule (for local periodic execution)')
  .option('--interval <minutes>', 'Interval in minutes between checks', '60')
  .option('--no-exclude-forks', 'Include forked repositories in the search')
  .option('--notify', 'Send notification when leaks are detected')
  .option('--notification-url <url>', 'URL for sending notifications')
  .option('--notification-type <type>', 'Notification type: slack, webhook, email', 'slack')
  .option('--notification-message <message>', 'Custom notification message')
  .option('--api-token <token>', 'GitHub API token')
  .option('--patterns <patterns>', 'Comma-separated search patterns')
  .option('--max-results <number>', 'Maximum number of results to return', '50')
  .option('--search-method <method>', 'Search method: blob-hash, pattern, or hybrid', 'blob-hash')
  .option('--max-blob-hashes <number>', 'Maximum number of blob hashes to search', '50')
  .option('--blob-batch-size <number>', 'Number of blob hashes per batch', '20')
  .option('--match-threshold <percent>', 'Minimum match percentage to report', '30')
  .option('--high-match-threshold <percent>', 'High risk threshold percentage', '80')
  .action(async (options) => {
    const intervalMinutes = parseInt(options.interval, 10);
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(chalk.blue(`🕐 Starting scheduled leak detection (every ${intervalMinutes} minutes)...`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    const detectionOptions: DetectionOptions = {
      excludeForks: options.excludeForks !== false,
      notify: options.notify || false,
      notificationUrl: options.notificationUrl,
      notificationType: options.notificationType as 'slack' | 'webhook' | 'email',
      notificationMessage: options.notificationMessage,
      apiToken: options.apiToken || process.env.GITHUB_TOKEN,
      searchPatterns: options.patterns ? options.patterns.split(',').map((p: string) => p.trim()) : undefined,
      maxResults: parseInt(options.maxResults, 10),
      searchMethod: options.searchMethod as 'blob-hash' | 'pattern' | 'hybrid',
      maxBlobHashesToSearch: parseInt(options.maxBlobHashes, 10),
      blobHashBatchSize: parseInt(options.blobBatchSize, 10),
      matchThresholdPercent: parseFloat(options.matchThreshold),
      highMatchThresholdPercent: parseFloat(options.highMatchThreshold)
    };

    const runDetection = async () => {
      try {
        console.log(chalk.blue(`\n[${new Date().toLocaleString()}] Running detection...`));
        const detector = new LeakDetector(detectionOptions);
        await detector.detect();
        console.log(chalk.gray(`Next check in ${intervalMinutes} minutes...`));
      } catch (error) {
        console.error(chalk.red('Error during scheduled detection:'), error instanceof Error ? error.message : error);
      }
    };

    // 初回実行
    await runDetection();

    // 定期実行
    setInterval(runDetection, intervalMs);
  });

program.parse(process.argv);

// コマンドが指定されていない場合はヘルプを表示
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
