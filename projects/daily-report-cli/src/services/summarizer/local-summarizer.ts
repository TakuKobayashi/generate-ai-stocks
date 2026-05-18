import natural from 'natural';
import compromise from 'compromise';
import { DailyReportData, GitCommit, GitHubCommit, Task } from '../../types';

export interface SummaryResult {
  threeLineSummary: string[];
  stats: {
    totalCommits: number;
    totalPRComments: number;
    totalCompletedTasks: number;
    totalCreatedTasks: number;
    totalComments: number;
  };
}

export class LocalSummarizer {
  private tokenizer: any;
  private tfidf: any;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
  }

  /**
   * データ全体から3行の要約を生成
   */
  public summarize(data: DailyReportData): SummaryResult {
    const stats = this.calculateStats(data);
    const sentences = this.extractSentences(data);
    const summary = this.generateThreeLineSummary(sentences, stats);

    return {
      threeLineSummary: summary,
      stats,
    };
  }

  /**
   * 統計情報を計算
   */
  private calculateStats(data: DailyReportData) {
    return {
      totalCommits: data.git.commits.length + data.github.commits.length,
      totalPRComments: data.github.prComments.length,
      totalCompletedTasks:
        data.asana.completedTasks.length +
        data.googleTasks.completedTasks.length +
        data.trello.completedTasks.length,
      totalCreatedTasks:
        data.asana.createdTasks.length +
        data.googleTasks.createdTasks.length +
        data.trello.createdTasks.length,
      totalComments:
        data.asana.comments.length +
        data.trello.comments.length,
    };
  }

  /**
   * データから文章を抽出
   */
  private extractSentences(data: DailyReportData): string[] {
    const sentences: string[] = [];

    // コミットメッセージから抽出
    data.git.commits.forEach((commit: GitCommit) => {
      const firstLine = commit.message.split('\n')[0];
      if (firstLine.length > 10) {
        sentences.push(firstLine);
      }
    });

    data.github.commits.forEach((commit: GitHubCommit) => {
      const firstLine = commit.message.split('\n')[0];
      if (firstLine.length > 10) {
        sentences.push(firstLine);
      }
    });

    // PRコメントから抽出
    data.github.prComments.forEach(comment => {
      const firstLine = comment.comment.split('\n')[0];
      if (firstLine.length > 10) {
        sentences.push(firstLine);
      }
    });

    // タスクタイトルから抽出
    [
      ...data.asana.completedTasks,
      ...data.asana.createdTasks,
      ...data.googleTasks.completedTasks,
      ...data.googleTasks.createdTasks,
      ...data.trello.completedTasks,
      ...data.trello.createdTasks,
    ].forEach((task: Task) => {
      if (task.title && task.title.length > 5) {
        sentences.push(task.title);
      }
    });

    return sentences;
  }

  /**
   * 3行要約を生成
   */
  private generateThreeLineSummary(
    sentences: string[],
    stats: any
  ): string[] {
    if (sentences.length === 0) {
      return [
        '本日の活動はありませんでした。',
        '',
        '',
      ];
    }

    // 1行目: 統計サマリー
    const line1 = this.generateStatsSummary(stats);

    // 2-3行目: 重要な活動を抽出
    const importantActivities = this.extractImportantActivities(sentences);

    return [line1, ...importantActivities].slice(0, 3);
  }

  /**
   * 統計サマリーを生成
   */
  private generateStatsSummary(stats: any): string {
    const parts: string[] = [];

    if (stats.totalCommits > 0) {
      parts.push(`${stats.totalCommits}件のコミット`);
    }

    if (stats.totalCompletedTasks > 0) {
      parts.push(`${stats.totalCompletedTasks}件のタスク完了`);
    }

    if (stats.totalCreatedTasks > 0) {
      parts.push(`${stats.totalCreatedTasks}件のタスク作成`);
    }

    if (stats.totalPRComments > 0) {
      parts.push(`${stats.totalPRComments}件のPRレビュー`);
    }

    if (parts.length === 0) {
      return '本日の活動はありませんでした。';
    }

    return '本日は' + parts.join('、') + 'を行いました。';
  }

  /**
   * 重要な活動を抽出(TF-IDF + キーワードベース)
   */
  private extractImportantActivities(sentences: string[]): string[] {
    if (sentences.length === 0) {
      return ['', ''];
    }

    // TF-IDFで文章をスコアリング
    sentences.forEach(sentence => {
      this.tfidf.addDocument(sentence);
    });

    // 各文のスコアを計算
    const scoredSentences = sentences.map((sentence, idx) => {
      let score = 0;
      const terms = this.tokenizer.tokenize(sentence.toLowerCase());

      terms.forEach((term: string) => {
        score += this.tfidf.tfidf(term, idx);
      });

      // 重要なキーワードにボーナス
      const importantKeywords = [
        'implement', '実装', 'fix', '修正', 'bug', 'バグ',
        'feature', '機能', 'release', 'リリース', 'deploy', 'デプロイ',
        'refactor', 'リファクタ', 'optimize', '最適化', 'update', '更新',
        'complete', '完了', 'finish', '終了'
      ];

      importantKeywords.forEach(keyword => {
        if (sentence.toLowerCase().includes(keyword)) {
          score += 10;
        }
      });

      return { sentence, score };
    });

    // スコア順にソート
    scoredSentences.sort((a, b) => b.score - a.score);

    // 上位2つを取得(重複を避ける)
    const result: string[] = [];
    const seen = new Set<string>();

    for (const item of scoredSentences) {
      const normalized = item.sentence.toLowerCase().trim();
      if (!seen.has(normalized) && item.sentence.length > 10) {
        result.push(this.cleanSentence(item.sentence));
        seen.add(normalized);
        if (result.length >= 2) break;
      }
    }

    // 2行に満たない場合は空文字で埋める
    while (result.length < 2) {
      result.push('');
    }

    return result;
  }

  /**
   * 文章をクリーンアップ
   */
  private cleanSentence(sentence: string): string {
    // 改行を削除
    let clean = sentence.replace(/\n/g, ' ').trim();
    
    // 100文字以内に制限
    if (clean.length > 100) {
      clean = clean.substring(0, 97) + '...';
    }

    return clean;
  }

  /**
   * キーワードを抽出
   */
  public extractKeywords(sentences: string[], topN: number = 5): string[] {
    if (sentences.length === 0) return [];

    const text = sentences.join(' ');
    const doc = compromise(text);

    // 名詞句を抽出
    const nouns = doc.nouns().out('array') as string[];
    const verbs = doc.verbs().out('array') as string[];

    // 頻度をカウント
    const frequency = new Map<string, number>();
    [...nouns, ...verbs].forEach(word => {
      const normalized = word.toLowerCase();
      if (normalized.length > 2) {
        frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
      }
    });

    // 頻度順にソート
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);

    return sorted;
  }
}
