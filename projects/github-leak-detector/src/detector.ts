import { DetectionOptions, LeakResult } from './types';
import { GitUtils } from './git-utils';
import { GitHubClient } from './github-client';
import { Notifier } from './notifier';
import chalk from 'chalk';

export class LeakDetector {
  private options: DetectionOptions;
  private githubClient: GitHubClient;

  constructor(options: DetectionOptions = {}) {
    this.options = {
      excludeForks: true,
      notify: false,
      maxResults: 50,
      ...options
    };
    this.githubClient = new GitHubClient(this.options.apiToken);
  }

  /**
   * 流出検出を実行
   */
  async detect(): Promise<LeakResult[]> {
    console.log(chalk.blue('🔍 Starting GitHub leak detection...\n'));

    // 現在のリポジトリ情報を取得
    const currentRepo = GitUtils.getCurrentRemoteInfo();
    console.log(chalk.gray(`Current repository: ${currentRepo.owner}/${currentRepo.repo}`));
    console.log(chalk.gray(`Repository URL: ${currentRepo.url}\n`));

    // 検索パターンを取得
    let patterns: string[];
    if (this.options.searchPatterns && this.options.searchPatterns.length > 0) {
      patterns = this.options.searchPatterns;
      console.log(chalk.gray('Using custom search patterns:'));
    } else {
      console.log(chalk.gray('Extracting unique patterns from repository...'));
      patterns = GitUtils.extractUniquePatterns();
      console.log(chalk.gray('Auto-detected patterns:'));
    }
    
    patterns.forEach(p => console.log(chalk.gray(`  - "${p}"`)));
    console.log();

    // GitHub検索を実行
    console.log(chalk.blue('Searching GitHub for potential leaks...\n'));
    const leaks = await this.githubClient.detectLeaks(
      patterns,
      currentRepo,
      this.options.excludeForks,
      this.options.maxResults
    );

    // オーナー情報を取得
    if (leaks.length > 0 && this.options.apiToken) {
      console.log(chalk.gray('Enriching results with owner information...'));
      const enrichedLeaks = await this.githubClient.enrichLeaksWithOwnerInfo(leaks);
      
      // 結果を表示
      this.displayResults(enrichedLeaks);

      // 通知送信
      if (this.options.notify && this.options.notificationUrl && this.options.notificationType) {
        console.log(chalk.blue('\n📤 Sending notification...'));
        await Notifier.send(
          this.options.notificationType,
          this.options.notificationUrl,
          enrichedLeaks,
          `${currentRepo.owner}/${currentRepo.repo}`,
          this.options.notificationMessage
        );
      }

      return enrichedLeaks;
    } else {
      this.displayResults(leaks);

      // 通知送信
      if (this.options.notify && this.options.notificationUrl && this.options.notificationType && leaks.length > 0) {
        console.log(chalk.blue('\n📤 Sending notification...'));
        await Notifier.send(
          this.options.notificationType,
          this.options.notificationUrl,
          leaks,
          `${currentRepo.owner}/${currentRepo.repo}`,
          this.options.notificationMessage
        );
      }

      return leaks;
    }
  }

  /**
   * 結果を表示
   */
  private displayResults(leaks: LeakResult[]): void {
    console.log(chalk.blue(`\n${'='.repeat(80)}`));
    console.log(chalk.blue.bold(`📊 Detection Results`));
    console.log(chalk.blue(`${'='.repeat(80)}\n`));

    if (leaks.length === 0) {
      console.log(chalk.green('✓ No leaks detected! Your code appears to be safe.'));
      return;
    }

    console.log(chalk.yellow(`⚠️  Found ${leaks.length} potential leak(s):\n`));

    leaks.forEach((leak, index) => {
      console.log(chalk.red(`[${index + 1}] ${leak.repositoryName}`));
      console.log(chalk.gray(`    URL: ${leak.repositoryUrl}`));
      console.log(chalk.gray(`    Owner: ${leak.ownerName} (${leak.ownerGithubUrl})`));
      if (leak.ownerEmail) {
        console.log(chalk.gray(`    Email: ${leak.ownerEmail}`));
      }
      console.log(chalk.gray(`    Created: ${new Date(leak.createdAt).toLocaleString()}`));
      console.log(chalk.gray(`    Is Fork: ${leak.isFork ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`    Matched Pattern: "${leak.matchedPattern}"`));
      if (leak.matchedFile) {
        console.log(chalk.gray(`    Matched File: ${leak.matchedFile}`));
      }
      console.log();
    });

    console.log(chalk.yellow(`\n⚠️  Total: ${leaks.length} potential leak(s) detected`));
    console.log(chalk.gray('Please review these repositories to determine if they are legitimate or unauthorized copies.\n'));
  }

  /**
   * JSON形式で結果を出力
   */
  async detectAndOutputJson(): Promise<string> {
    const leaks = await this.detect();
    return JSON.stringify(leaks, null, 2);
  }
}
