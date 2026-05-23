import fetch from 'node-fetch';
import { SearchResult, LeakResult, GitRemoteInfo } from './types';

export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  /**
   * GitHub Code Search APIでコードを検索
   */
  async searchCode(query: string, page: number = 1): Promise<SearchResult> {
    const url = `${this.baseUrl}/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-leak-detector'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    try {
      const response = await fetch(url, { headers });

      if (response.status === 403) {
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleString() : 'unknown';
        throw new Error(`GitHub API rate limit exceeded. Resets at: ${resetTime}. Consider using an API token.`);
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as SearchResult;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to search GitHub');
    }
  }

  /**
   * Blobハッシュのバッチ検索
   * 複数のblobハッシュをORで連結して一度に検索
   */
  async searchByBlobHashBatch(blobHashes: string[]): Promise<SearchResult> {
    // ハッシュをORで連結
    const hashQuery = blobHashes.map(h => `hash:${h}`).join(' OR ');
    
    try {
      const result = await this.searchCode(hashQuery);
      return result;
    } catch (error) {
      console.warn('Batch blob hash search failed:', error);
      return { total_count: 0, incomplete_results: false, items: [] };
    }
  }

  /**
   * Blobハッシュを使用して流出を検出（バッチ処理版）
   */
  async detectLeaksByBlobHashes(
    blobHashes: Array<{file: string, hash: string}>,
    currentRepo: GitRemoteInfo,
    excludeForks: boolean = true,
    batchSize: number = 20,
    matchThreshold: number = 30,
    highMatchThreshold: number = 80
  ): Promise<LeakResult[]> {
    console.log(`Starting blob hash search for ${blobHashes.length} files...`);
    console.log(`Batch size: ${batchSize}, Match threshold: ${matchThreshold}%`);

    // リポジトリごとのマッチング情報を記録
    const repoMatches = new Map<string, {
      matchedHashes: Set<string>;
      matchedFiles: Set<string>;
      repository: any;
    }>();

    // バッチごとに検索
    const batches = this.createBatches(blobHashes, batchSize);
    console.log(`Searching in ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} hashes)...`);

      try {
        const hashes = batch.map(b => b.hash);
        const result = await this.searchByBlobHashBatch(hashes);

        // 結果を処理
        for (const item of result.items) {
          const repoFullName = item.repository.full_name;

          // 自分のリポジトリは除外
          if (repoFullName === `${currentRepo.owner}/${currentRepo.repo}`) {
            continue;
          }

          // フォークを除外する設定の場合
          if (excludeForks && item.repository.fork) {
            continue;
          }

          // リポジトリのマッチング情報を更新
          if (!repoMatches.has(repoFullName)) {
            repoMatches.set(repoFullName, {
              matchedHashes: new Set(),
              matchedFiles: new Set(),
              repository: item.repository
            });
          }

          const repoMatch = repoMatches.get(repoFullName)!;
          repoMatch.matchedHashes.add(item.sha);
          repoMatch.matchedFiles.add(item.path);
        }

        // レート制限対策
        await this.sleep(2000);
      } catch (error) {
        console.error(`Error in batch ${i + 1}:`, error);
      }
    }

    // マッチング閾値を超えたリポジトリをLeakResultに変換
    const leaks: LeakResult[] = [];
    const totalFilesChecked = blobHashes.length;

    for (const [repoFullName, matchInfo] of repoMatches.entries()) {
      const matchedCount = matchInfo.matchedHashes.size;
      const matchPercentage = (matchedCount / totalFilesChecked) * 100;

      // 閾値チェック
      if (matchPercentage >= matchThreshold) {
        // リスクレベルを判定
        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        if (matchPercentage >= 95) {
          riskLevel = 'critical';
        } else if (matchPercentage >= highMatchThreshold) {
          riskLevel = 'high';
        } else if (matchPercentage >= 50) {
          riskLevel = 'medium';
        } else {
          riskLevel = 'low';
        }

        const leak: LeakResult = {
          repositoryUrl: matchInfo.repository.html_url,
          repositoryName: matchInfo.repository.full_name,
          ownerName: matchInfo.repository.owner.login,
          ownerGithubUrl: matchInfo.repository.owner.html_url,
          createdAt: matchInfo.repository.created_at,
          isFork: matchInfo.repository.fork,
          matchedPattern: `${matchedCount} files matched`,
          matchType: 'blob-hash',
          matchedFilesCount: matchedCount,
          totalFilesChecked: totalFilesChecked,
          matchPercentage: Math.round(matchPercentage * 100) / 100,
          riskLevel: riskLevel,
          matchedHashes: Array.from(matchInfo.matchedHashes).slice(0, 10) // 最大10個まで記録
        };

        leaks.push(leak);
      }
    }

    // リスクレベルとマッチング率でソート
    leaks.sort((a, b) => {
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const riskDiff = riskOrder[b.riskLevel!] - riskOrder[a.riskLevel!];
      if (riskDiff !== 0) return riskDiff;
      return (b.matchPercentage || 0) - (a.matchPercentage || 0);
    });

    console.log(`\nFound ${leaks.length} repositories matching the threshold`);
    
    return leaks;
  }

  /**
   * ハイブリッド検索: Blobハッシュ + パターン検索
   */
  async detectLeaksHybrid(
    blobHashes: Array<{file: string, hash: string}>,
    patterns: string[],
    currentRepo: GitRemoteInfo,
    excludeForks: boolean = true,
    batchSize: number = 20,
    matchThreshold: number = 30,
    highMatchThreshold: number = 80,
    maxResults: number = 50
  ): Promise<LeakResult[]> {
    console.log('Using hybrid detection method (blob hashes + patterns)...\n');

    // まずblobハッシュで検索
    const blobLeaks = await this.detectLeaksByBlobHashes(
      blobHashes,
      currentRepo,
      excludeForks,
      batchSize,
      matchThreshold,
      highMatchThreshold
    );

    console.log(`\nBlob hash search found ${blobLeaks.length} potential leaks`);

    // 次にパターンで検索（補完的に）
    if (patterns.length > 0) {
      console.log('\nRunning pattern search for additional verification...');
      const patternLeaks = await this.detectLeaks(
        patterns,
        currentRepo,
        excludeForks,
        Math.min(10, maxResults) // パターン検索は補完的なので少なめに
      );

      console.log(`Pattern search found ${patternLeaks.length} additional repositories`);

      // 結果をマージ（重複を除去）
      const allLeaksMap = new Map<string, LeakResult>();
      
      for (const leak of blobLeaks) {
        allLeaksMap.set(leak.repositoryName, leak);
      }

      for (const leak of patternLeaks) {
        if (!allLeaksMap.has(leak.repositoryName)) {
          allLeaksMap.set(leak.repositoryName, leak);
        }
      }

      return Array.from(allLeaksMap.values()).slice(0, maxResults);
    }

    return blobLeaks.slice(0, maxResults);
  }

  /**
   * 配列をバッチに分割
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * パターンでコードを検索し、流出を検出
   */
  async detectLeaks(
    patterns: string[],
    currentRepo: GitRemoteInfo,
    excludeForks: boolean = true,
    maxResults: number = 50
  ): Promise<LeakResult[]> {
    const leaks: LeakResult[] = [];
    const seenRepos = new Set<string>();

    for (const pattern of patterns) {
      console.log(`Searching for pattern: "${pattern}"`);
      
      try {
        // パターンを検索クエリに変換（言語を限定しない）
        const query = `"${pattern}"`;
        const result = await this.searchCode(query);

        for (const item of result.items) {
          const repoFullName = item.repository.full_name;
          
          // 自分のリポジトリは除外
          if (repoFullName === `${currentRepo.owner}/${currentRepo.repo}`) {
            continue;
          }

          // フォークを除外する設定の場合
          if (excludeForks && item.repository.fork) {
            continue;
          }

          // 既に検出済みのリポジトリはスキップ
          if (seenRepos.has(repoFullName)) {
            continue;
          }

          seenRepos.add(repoFullName);

          // 流出として記録
          const leak: LeakResult = {
            repositoryUrl: item.repository.html_url,
            repositoryName: item.repository.full_name,
            ownerName: item.repository.owner.login,
            ownerGithubUrl: item.repository.owner.html_url,
            createdAt: item.repository.created_at,
            isFork: item.repository.fork,
            matchedPattern: pattern,
            matchedFile: item.path,
            matchType: 'pattern'
          };

          leaks.push(leak);

          // 最大結果数に達したら終了
          if (leaks.length >= maxResults) {
            break;
          }
        }

        // レート制限を考慮して少し待機
        await this.sleep(1000);

        if (leaks.length >= maxResults) {
          break;
        }
      } catch (error) {
        console.error(`Error searching pattern "${pattern}":`, error instanceof Error ? error.message : error);
      }
    }

    return leaks;
  }

  /**
   * リポジトリオーナーの情報を取得
   */
  async getOwnerInfo(username: string): Promise<{ email?: string; name?: string }> {
    const url = `${this.baseUrl}/users/${username}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-leak-detector'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        return {};
      }

      const data = await response.json() as any;
      return {
        email: data.email || undefined,
        name: data.name || undefined
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * 流出結果にオーナー情報を追加
   */
  async enrichLeaksWithOwnerInfo(leaks: LeakResult[]): Promise<LeakResult[]> {
    const enrichedLeaks: LeakResult[] = [];

    for (const leak of leaks) {
      const ownerInfo = await this.getOwnerInfo(leak.ownerName);
      enrichedLeaks.push({
        ...leak,
        ownerEmail: ownerInfo.email
      });
      
      // レート制限対策
      await this.sleep(500);
    }

    return enrichedLeaks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
