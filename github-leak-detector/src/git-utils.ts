import { execSync } from 'child_process';
import { GitRemoteInfo } from './types';

export class GitUtils {
  /**
   * 現在のリポジトリのリモートURL情報を取得
   */
  static getCurrentRemoteInfo(): GitRemoteInfo {
    try {
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const parsed = this.parseGitUrl(remoteUrl);
      return parsed;
    } catch (error) {
      throw new Error('Failed to get git remote URL. Make sure you are in a git repository.');
    }
  }

  /**
   * GitのURLをパース
   */
  static parseGitUrl(url: string): GitRemoteInfo {
    // HTTPS形式: https://github.com/owner/repo.git
    const httpsMatch = url.match(/https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (httpsMatch) {
      return {
        url: `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`,
        owner: httpsMatch[1],
        repo: httpsMatch[2]
      };
    }

    // SSH形式: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)/);
    if (sshMatch) {
      return {
        url: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`,
        owner: sshMatch[1],
        repo: sshMatch[2]
      };
    }

    throw new Error(`Unable to parse git URL: ${url}`);
  }

  /**
   * ユニークなコードパターンを抽出
   */
  static extractUniquePatterns(maxPatterns: number = 5): string[] {
    const patterns: string[] = [];

    try {
      // package.jsonからプロジェクト名を取得
      const packageJson = execSync('cat package.json 2>/dev/null || echo "{}"', { encoding: 'utf-8' });
      const pkg = JSON.parse(packageJson);
      if (pkg.name) {
        patterns.push(pkg.name);
      }

      // ユニークな関数名やクラス名を検索（TypeScript/JavaScript）
      const tsFiles = execSync(
        'git ls-files "*.ts" "*.tsx" "*.js" "*.jsx" 2>/dev/null | head -5',
        { encoding: 'utf-8' }
      ).trim();

      if (tsFiles) {
        const files = tsFiles.split('\n').filter(f => f);
        for (const file of files.slice(0, 3)) {
          try {
            const content = execSync(`head -50 "${file}" 2>/dev/null`, { encoding: 'utf-8' });
            
            // クラス名を抽出
            const classMatches = content.match(/class\s+([A-Z][a-zA-Z0-9_]+)/g);
            if (classMatches) {
              patterns.push(...classMatches.map(m => m.replace('class ', '')).slice(0, 2));
            }

            // export const/function を抽出
            const exportMatches = content.match(/export\s+(?:const|function)\s+([a-zA-Z_][a-zA-Z0-9_]+)/g);
            if (exportMatches) {
              patterns.push(...exportMatches.map(m => m.split(' ').pop()!).slice(0, 2));
            }
          } catch (e) {
            // ファイル読み取りエラーは無視
          }
        }
      }

      // README.mdから特徴的な文字列を取得
      try {
        const readme = execSync('head -20 README.md 2>/dev/null', { encoding: 'utf-8' });
        const title = readme.match(/^#\s+(.+)$/m);
        if (title && title[1]) {
          patterns.push(title[1].trim());
        }
      } catch (e) {
        // README がない場合は無視
      }

    } catch (error) {
      console.warn('Warning: Failed to extract some patterns');
    }

    // 重複を除去してユニークなパターンのみを返す
    const uniquePatterns = [...new Set(patterns)].slice(0, maxPatterns);
    
    if (uniquePatterns.length === 0) {
      throw new Error('No unique patterns found. Please specify search patterns manually using --patterns option.');
    }

    return uniquePatterns;
  }

  /**
   * 最近のコミットハッシュを取得
   */
  static getRecentCommits(count: number = 10): string[] {
    try {
      const commits = execSync(`git log -${count} --format=%H`, { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(hash => hash);
      return commits;
    } catch (error) {
      throw new Error('Failed to get commit history');
    }
  }
}
