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
      searchMethod: 'blob-hash', // デフォルトはblobハッシュ検索
      maxBlobHashesToSearch: 50,
      blobHashBatchSize: 20,
      matchThresholdPercent: 30,
      highMatchThresholdPercent: 80,
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

    let leaks: LeakResult[] = [];

    // 検索方法によって処理を分岐
    switch (this.options.searchMethod) {
      case 'blob-hash':
        leaks = await this.detectByBlobHashes(currentRepo);
        break;
      case 'pattern':
        leaks = await this.detectByPatterns(currentRepo);
        break;
      case 'hybrid':
        leaks = await this.detectHybrid(currentRepo);
        break;
      default:
        leaks = await this.detectByBlobHashes(currentRepo);
    }

    // オーナー情報を取得（APIトークンがある場合のみ）
    if (leaks.length > 0 && this.options.apiToken) {
      console.log(chalk.gray('\nEnriching results with owner information...'));
      leaks = await this.githubClient.enrichLeaksWithOwnerInfo(leaks);
    }

    // 結果を表示
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

  /**
   * Blobハッシュを使用した検出
   */
  private async detectByBlobHashes(currentRepo: any): Promise<LeakResult[]> {
    console.log(chalk.blue('🔐 Using blob hash detection method (most accurate)\n'));

    // Blobハッシュを取得
    console.log(chalk.gray('Extracting file blob hashes from repository...'));
    const blobHashes = GitUtils.getFileBlobHashes(this.options.maxBlobHashesToSearch!);
    
    if (blobHashes.length === 0) {
      throw new Error('No files found in repository');
    }

    console.log(chalk.gray(`Found ${blobHashes.length} files to check`));
    console.log(chalk.gray(`Match threshold: ${this.options.matchThresholdPercent}%`));
    console.log(chalk.gray(`High risk threshold: ${this.options.highMatchThresholdPercent}%\n`));

    // GitHub検索を実行
    const leaks = await this.githubClient.detectLeaksByBlobHashes(
      blobHashes,
      currentRepo,
      this.options.excludeForks!,
      this.options.blobHashBatchSize!,
      this.options.matchThresholdPercent!,
      this.options.highMatchThresholdPercent!
    );

    return leaks;
  }

  /**
   * パターンを使用した検出
   */
  private async detectByPatterns(currentRepo: any): Promise<LeakResult[]> {
    console.log(chalk.blue('🔤 Using pattern detection method\n'));

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

    return leaks;
  }

  /**
   * ハイブリッド検出（Blobハッシュ + パターン）
   */
  private async detectHybrid(currentRepo: any): Promise<LeakResult[]> {
    console.log(chalk.blue('🔀 Using hybrid detection method (blob hash + patterns)\n'));

    // Blobハッシュを取得
    const blobHashes = GitUtils.getFileBlobHashes(this.options.maxBlobHashesToSearch!);
    
    // パターンを取得
    let patterns: string[];
    if (this.options.searchPatterns && this.options.searchPatterns.length > 0) {
      patterns = this.options.searchPatterns;
    } else {
      patterns = GitUtils.extractUniquePatterns(5); // ハイブリッドでは少なめに
    }

    console.log(chalk.gray(`Checking ${blobHashes.length} file hashes and ${patterns.length} patterns\n`));

    // ハイブリッド検索を実行
    const leaks = await this.githubClient.detectLeaksHybrid(
      blobHashes,
      patterns,
      currentRepo,
      this.options.excludeForks!,
      this.options.blobHashBatchSize!,
      this.options.matchThresholdPercent!,
      this.options.highMatchThresholdPercent!,
      this.options.maxResults!
    );

    return leaks;
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
      // リスクレベルによって色を変更
      let riskColor = chalk.yellow;
      let riskEmoji = '⚠️ ';
      if (leak.riskLevel === 'critical') {
        riskColor = chalk.red.bold;
        riskEmoji = '🚨 ';
      } else if (leak.riskLevel === 'high') {
        riskColor = chalk.red;
        riskEmoji = '❗ ';
      } else if (leak.riskLevel === 'medium') {
        riskColor = chalk.yellow;
        riskEmoji = '⚠️  ';
      } else if (leak.riskLevel === 'low') {
        riskColor = chalk.blue;
        riskEmoji = 'ℹ️  ';
      }

      console.log(riskColor(`${riskEmoji}[${index + 1}] ${leak.repositoryName}`));
      
      if (leak.matchType === 'blob-hash' && leak.matchPercentage !== undefined) {
        console.log(riskColor(`    Match: ${leak.matchedFilesCount}/${leak.totalFilesChecked} files (${leak.matchPercentage}%) - Risk: ${leak.riskLevel?.toUpperCase()}`));
      }
      
      console.log(chalk.gray(`    URL: ${leak.repositoryUrl}`));
      console.log(chalk.gray(`    Owner: ${leak.ownerName} (${leak.ownerGithubUrl})`));
      
      if (leak.ownerEmail) {
        console.log(chalk.gray(`    Email: ${leak.ownerEmail}`));
      }
      
      console.log(chalk.gray(`    Created: ${new Date(leak.createdAt).toLocaleString()}`));
      console.log(chalk.gray(`    Is Fork: ${leak.isFork ? 'Yes' : 'No'}`));
      
      if (leak.matchType === 'pattern') {
        console.log(chalk.gray(`    Matched Pattern: "${leak.matchedPattern}"`));
        if (leak.matchedFile) {
          console.log(chalk.gray(`    Matched File: ${leak.matchedFile}`));
        }
      }
      
      console.log();
    });

    // サマリー統計
    const criticalCount = leaks.filter(l => l.riskLevel === 'critical').length;
    const highCount = leaks.filter(l => l.riskLevel === 'high').length;
    const mediumCount = leaks.filter(l => l.riskLevel === 'medium').length;
    const lowCount = leaks.filter(l => l.riskLevel === 'low').length;

    console.log(chalk.yellow(`\n📈 Risk Summary:`));
    if (criticalCount > 0) console.log(chalk.red.bold(`   🚨 Critical: ${criticalCount}`));
    if (highCount > 0) console.log(chalk.red(`   ❗ High: ${highCount}`));
    if (mediumCount > 0) console.log(chalk.yellow(`   ⚠️  Medium: ${mediumCount}`));
    if (lowCount > 0) console.log(chalk.blue(`   ℹ️  Low: ${lowCount}`));

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
