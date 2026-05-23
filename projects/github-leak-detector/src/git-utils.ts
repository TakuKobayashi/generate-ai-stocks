import { execSync } from 'child_process';
import { GitRemoteInfo } from './types';
import * as fs from 'fs';
import * as path from 'path';

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

  /**
   * 特定のファイルのblobハッシュを取得
   */
  static getFileBlobHashes(maxFiles: number = 10): Array<{file: string, hash: string}> {
    try {
      // Gitで管理されているファイルのハッシュを取得
      const output = execSync(
        `git ls-files -s | head -${maxFiles}`,
        { encoding: 'utf-8' }
      ).trim();

      const hashes: Array<{file: string, hash: string}> = [];
      const lines = output.split('\n').filter(l => l);

      for (const line of lines) {
        // フォーマット: "100644 <hash> 0 <filename>"
        const match = line.match(/^\d+\s+([a-f0-9]{40})\s+\d+\s+(.+)$/);
        if (match) {
          hashes.push({
            file: match[2],
            hash: match[1]
          });
        }
      }

      return hashes;
    } catch (error) {
      throw new Error('Failed to get file blob hashes');
    }
  }

  /**
   * ユニークな文字列をファイルから抽出（言語非依存）
   */
  static extractUniquePatterns(maxPatterns: number = 10): string[] {
    const patterns: string[] = [];

    try {
      // Gitで管理されているすべてのファイルを取得
      const allFiles = execSync('git ls-files', { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(f => f);

      // 特定の拡張子のファイルを優先的に処理
      const priorityExtensions = [
        '.md', '.txt', '.rst',  // ドキュメント
        '.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php',  // コード
        '.json', '.yaml', '.yml', '.xml', '.toml'  // 設定ファイル
      ];

      // ファイルを拡張子で分類
      const categorizedFiles: {[key: string]: string[]} = {};
      for (const file of allFiles) {
        const ext = path.extname(file);
        if (!categorizedFiles[ext]) {
          categorizedFiles[ext] = [];
        }
        categorizedFiles[ext].push(file);
      }

      // README系ファイルからプロジェクト名を抽出
      const readmeFiles = allFiles.filter(f => 
        f.toLowerCase().match(/^readme/i) || f.toLowerCase().match(/readme\.(md|txt|rst)$/i)
      );

      for (const readmeFile of readmeFiles.slice(0, 2)) {
        try {
          const content = execSync(`head -30 "${readmeFile}" 2>/dev/null`, { encoding: 'utf-8' });
          
          // Markdownのタイトルを抽出
          const titleMatch = content.match(/^#\s+(.+)$/m);
          if (titleMatch && titleMatch[1]) {
            const title = titleMatch[1].trim().replace(/[^\w\s-]/g, '');
            if (title.length > 3 && title.length < 50) {
              patterns.push(title);
            }
          }

          // 括弧や引用符で囲まれた文字列（プロジェクト名など）
          const quotedMatches = content.match(/["'`]([A-Z][a-zA-Z0-9_-]{3,30})["'`]/g);
          if (quotedMatches) {
            patterns.push(...quotedMatches.map(m => m.slice(1, -1)).slice(0, 2));
          }
        } catch (e) {
          // ファイル読み取りエラーは無視
        }
      }

      // プログラムファイルから識別子を抽出
      const codeFiles: string[] = [];
      for (const ext of priorityExtensions) {
        if (categorizedFiles[ext]) {
          codeFiles.push(...categorizedFiles[ext].slice(0, 3));
        }
      }

      for (const file of codeFiles.slice(0, 10)) {
        try {
          const content = execSync(`head -100 "${file}" 2>/dev/null`, { encoding: 'utf-8' });
          
          // クラス名（言語共通パターン）
          const classMatches = content.match(/class\s+([A-Z][a-zA-Z0-9_]{3,30})/g);
          if (classMatches) {
            patterns.push(...classMatches.map(m => m.replace(/class\s+/, '')).slice(0, 2));
          }

          // 関数定義（言語共通パターン）
          const funcMatches = content.match(/(?:function|def|func|fn|pub fn|private|public)\s+([a-z][a-zA-Z0-9_]{5,30})/g);
          if (funcMatches) {
            patterns.push(...funcMatches.map(m => m.split(/\s+/).pop()!).slice(0, 2));
          }

          // 定数（大文字のみの識別子）
          const constMatches = content.match(/\b([A-Z][A-Z0-9_]{5,30})\b/g);
          if (constMatches) {
            patterns.push(...constMatches.slice(0, 2));
          }

          // 特徴的な文字列リテラル
          const stringMatches = content.match(/["']([A-Z][a-zA-Z0-9_\s-]{8,40})["']/g);
          if (stringMatches) {
            patterns.push(...stringMatches.map(m => m.slice(1, -1)).slice(0, 1));
          }
        } catch (e) {
          // ファイル読み取りエラーは無視
        }
      }

      // プロジェクト設定ファイルから名前を抽出
      this.extractFromConfigFiles(patterns, allFiles);

    } catch (error) {
      console.warn('Warning: Failed to extract some patterns:', error);
    }

    // 重複を除去、短すぎる・長すぎるものを除外
    const uniquePatterns = [...new Set(patterns)]
      .filter(p => p.length >= 4 && p.length <= 50)
      .filter(p => !/^(test|main|index|app|utils?|common|core|base|default)$/i.test(p)) // 一般的すぎる名前を除外
      .slice(0, maxPatterns);

    return uniquePatterns;
  }

  /**
   * 設定ファイルからプロジェクト名を抽出
   */
  private static extractFromConfigFiles(patterns: string[], allFiles: string[]): void {
    const configFiles = {
      'package.json': (content: string) => {
        try {
          const pkg = JSON.parse(content);
          if (pkg.name) patterns.push(pkg.name);
        } catch (e) {}
      },
      'Cargo.toml': (content: string) => {
        const match = content.match(/name\s*=\s*"([^"]+)"/);
        if (match) patterns.push(match[1]);
      },
      'setup.py': (content: string) => {
        const match = content.match(/name\s*=\s*["']([^"']+)["']/);
        if (match) patterns.push(match[1]);
      },
      'pyproject.toml': (content: string) => {
        const match = content.match(/name\s*=\s*"([^"]+)"/);
        if (match) patterns.push(match[1]);
      },
      'pom.xml': (content: string) => {
        const match = content.match(/<artifactId>([^<]+)<\/artifactId>/);
        if (match) patterns.push(match[1]);
      },
      'build.gradle': (content: string) => {
        const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
        if (match) patterns.push(match[1]);
      },
      'go.mod': (content: string) => {
        const match = content.match(/module\s+([^\s]+)/);
        if (match) {
          const moduleName = match[1].split('/').pop();
          if (moduleName) patterns.push(moduleName);
        }
      },
      'composer.json': (content: string) => {
        try {
          const composer = JSON.parse(content);
          if (composer.name) {
            const projectName = composer.name.split('/').pop();
            if (projectName) patterns.push(projectName);
          }
        } catch (e) {}
      },
      'Gemfile': (content: string) => {
        const match = content.match(/gem\s+['"]([^'"]+)['"]/);
        if (match) patterns.push(match[1]);
      }
    };

    for (const [filename, extractor] of Object.entries(configFiles)) {
      const configFile = allFiles.find(f => f === filename || f.endsWith('/' + filename));
      if (configFile) {
        try {
          const content = fs.readFileSync(configFile, 'utf-8');
          extractor(content);
        } catch (e) {
          // ファイル読み取りエラーは無視
        }
      }
    }
  }
}
