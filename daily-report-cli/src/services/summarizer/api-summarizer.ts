import axios from 'axios';
import { DailyReportData, GitCommit, GitHubCommit, GitHubPRComment, Task } from '../../types';

export interface ApiSummaryOptions {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

export class ApiSummarizer {
  private provider: 'openai' | 'anthropic';
  private apiKey: string;
  private model: string;

  constructor(options: ApiSummaryOptions) {
    this.provider = options.provider;
    this.apiKey = options.apiKey;
    
    // デフォルトモデル
    this.model = options.model || 
      (options.provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-haiku-20240307');
  }

  /**
   * データ全体から3行の要約を生成
   */
  public async summarize(data: DailyReportData): Promise<string[]> {
    const prompt = this.buildPrompt(data);

    if (this.provider === 'openai') {
      return await this.summarizeWithOpenAI(prompt);
    } else {
      return await this.summarizeWithAnthropic(prompt);
    }
  }

  /**
   * プロンプトを構築
   */
  private buildPrompt(data: DailyReportData): string {
    const sections: string[] = [];

    // Gitコミット
    if (data.git.commits.length > 0) {
      sections.push('## Gitコミット');
      data.git.commits.slice(0, 20).forEach((commit: GitCommit) => {
        sections.push(`- ${commit.message.split('\n')[0]} (${commit.repository})`);
      });
    }

    // GitHubコミット
    if (data.github.commits.length > 0) {
      sections.push('\n## GitHubコミット');
      data.github.commits.slice(0, 20).forEach((commit: GitHubCommit) => {
        sections.push(`- ${commit.message.split('\n')[0]} (${commit.repository})`);
      });
    }

    // PRコメント
    if (data.github.prComments.length > 0) {
      sections.push('\n## PRコメント');
      data.github.prComments.slice(0, 10).forEach((comment: GitHubPRComment) => {
        sections.push(`- ${comment.prTitle}: ${comment.comment.substring(0, 100)}`);
      });
    }

    // 完了タスク
    const completedTasks: Task[] = [
      ...data.asana.completedTasks,
      ...data.googleTasks.completedTasks,
      ...data.trello.completedTasks,
    ];
    if (completedTasks.length > 0) {
      sections.push('\n## 完了タスク');
      completedTasks.slice(0, 15).forEach((task: Task) => {
        sections.push(`- ${task.title}`);
      });
    }

    // 新規タスク
    const createdTasks: Task[] = [
      ...data.asana.createdTasks,
      ...data.googleTasks.createdTasks,
      ...data.trello.createdTasks,
    ];
    if (createdTasks.length > 0) {
      sections.push('\n## 新規タスク');
      createdTasks.slice(0, 15).forEach((task: Task) => {
        sections.push(`- ${task.title}`);
      });
    }

    const context = sections.join('\n');

    return `以下は、エンジニアの本日の活動記録です。これを読んで、3行で要約してください。

要約のルール:
1. 1行目: 統計的なサマリー(コミット数、タスク数など)
2. 2行目: 最も重要な実装・作業内容
3. 3行目: その他の重要な活動またはレビュー活動

各行は簡潔に、専門用語を使って構いません。

活動記録:
${context}

3行要約:`;
  }

  /**
   * OpenAI APIで要約
   */
  private async summarizeWithOpenAI(prompt: string): Promise<string[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'あなたはエンジニアの活動を要約する専門家です。簡潔で正確な要約を提供してください。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content.trim();
      return this.parseResponse(content);
    } catch (error) {
      console.error('OpenAI API要約エラー:', error);
      throw error;
    }
  }

  /**
   * Anthropic APIで要約
   */
  private async summarizeWithAnthropic(prompt: string): Promise<string[]> {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.model,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const content = response.data.content[0].text.trim();
      return this.parseResponse(content);
    } catch (error) {
      console.error('Anthropic API要約エラー:', error);
      throw error;
    }
  }

  /**
   * レスポンスをパース
   */
  private parseResponse(content: string): string[] {
    // 行に分割
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // 番号や記号を削除
    const cleaned = lines.map(line => {
      return line
        .replace(/^[\d\.\-\*]+[\.\):\s]+/, '') // "1. ", "- ", "* "などを削除
        .trim();
    });

    // 3行に調整
    if (cleaned.length >= 3) {
      return cleaned.slice(0, 3);
    } else if (cleaned.length === 2) {
      return [...cleaned, ''];
    } else if (cleaned.length === 1) {
      return [...cleaned, '', ''];
    } else {
      return ['要約を生成できませんでした。', '', ''];
    }
  }
}
