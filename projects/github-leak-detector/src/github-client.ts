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
        // パターンを検索クエリに変換
        const query = `"${pattern}" language:typescript OR language:javascript`;
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
            matchedFile: item.path
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
