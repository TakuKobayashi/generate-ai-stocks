import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { MultiRepoGitService } from '../services/git/local-git';
import { GitHubService } from '../services/github/github-api';
import { AsanaService } from '../services/task-managers/asana';
import { GoogleTasksService } from '../services/task-managers/google-tasks';
import { TrelloService } from '../services/task-managers/trello';
import { TemplateRenderer, createDefaultTemplate } from '../template/renderer';
import { tokenStorage } from '../storage/token-storage';
import { DailyReportData, DateRange } from '../types';
import { LocalSummarizer } from '../services/summarizer/local-summarizer';
import { ApiSummarizer } from '../services/summarizer/api-summarizer';

interface GenerateOptions {
  template?: string;
  output?: string;
  githubToken?: string;
  asanaToken?: string;
  googleTasksToken?: string;
  trelloToken?: string;
  trelloApiKey?: string;
  date?: string;
  summarize?: boolean;
  summaryApi?: 'openai' | 'anthropic';
  summaryApiKey?: string;
  summaryModel?: string;
}

function getDateRange(dateStr?: string): DateRange {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export async function generateReport(options: GenerateOptions): Promise<void> {
  console.log('日報を生成しています...\n');

  const dateRange = getDateRange(options.date);
  const dateStr = format(dateRange.start, 'yyyy-MM-dd');

  // テンプレートの準備
  const templatePath = options.template || path.join(process.cwd(), 'template.md');
  
  if (!fs.existsSync(templatePath)) {
    console.log(`テンプレートファイルが見つかりません。デフォルトテンプレートを作成します: ${templatePath}`);
    createDefaultTemplate(templatePath);
  }

  const renderer = new TemplateRenderer(templatePath);

  // データ収集
  const reportData: DailyReportData = {
    date: dateStr,
    git: { commits: [] },
    github: { commits: [], prComments: [] },
    asana: { completedTasks: [], createdTasks: [], comments: [] },
    googleTasks: { completedTasks: [], createdTasks: [] },
    trello: { completedTasks: [], createdTasks: [], comments: [] },
  };

  // Git (ローカル)
  console.log('📁 ローカルGitリポジトリから情報を収集中...');
  try {
    const gitService = new MultiRepoGitService();
    reportData.git.commits = await gitService.getAllCommits(dateRange);
    console.log(`  ✓ ${reportData.git.commits.length}件のコミットを取得しました`);
  } catch (error) {
    console.error('  ✗ ローカルGitの取得に失敗:', error);
  }

  // GitHub
  const githubToken = options.githubToken || tokenStorage.getToken('github');
  if (githubToken) {
    console.log('🐙 GitHubから情報を収集中...');
    try {
      const githubService = new GitHubService(githubToken);
      reportData.github.commits = await githubService.getCommits(dateRange);
      reportData.github.prComments = await githubService.getPRComments(dateRange);
      console.log(`  ✓ ${reportData.github.commits.length}件のコミット、${reportData.github.prComments.length}件のPRコメントを取得しました`);
    } catch (error) {
      console.error('  ✗ GitHubの取得に失敗:', error);
    }
  } else {
    console.log('⚠️  GitHub: トークンが設定されていません (スキップ)');
  }

  // Asana
  const asanaToken = options.asanaToken || tokenStorage.getToken('asana');
  if (asanaToken) {
    console.log('📋 Asanaから情報を収集中...');
    try {
      const asanaService = new AsanaService(asanaToken);
      reportData.asana.completedTasks = await asanaService.getCompletedTasks(dateRange);
      reportData.asana.createdTasks = await asanaService.getCreatedTasks(dateRange);
      reportData.asana.comments = await asanaService.getComments(dateRange);
      console.log(`  ✓ 完了:${reportData.asana.completedTasks.length}件、作成:${reportData.asana.createdTasks.length}件、コメント:${reportData.asana.comments.length}件`);
    } catch (error) {
      console.error('  ✗ Asanaの取得に失敗:', error);
    }
  } else {
    console.log('⚠️  Asana: トークンが設定されていません (スキップ)');
  }

  // Google Tasks
  const googleTasksToken = options.googleTasksToken || tokenStorage.getToken('googleTasks');
  if (googleTasksToken) {
    console.log('✓ Google Tasksから情報を収集中...');
    try {
      const googleTasksService = new GoogleTasksService(googleTasksToken);
      reportData.googleTasks.completedTasks = await googleTasksService.getCompletedTasks(dateRange);
      reportData.googleTasks.createdTasks = await googleTasksService.getCreatedTasks(dateRange);
      console.log(`  ✓ 完了:${reportData.googleTasks.completedTasks.length}件、作成:${reportData.googleTasks.createdTasks.length}件`);
    } catch (error) {
      console.error('  ✗ Google Tasksの取得に失敗:', error);
    }
  } else {
    console.log('⚠️  Google Tasks: トークンが設定されていません (スキップ)');
  }

  // Trello
  const trelloToken = options.trelloToken || tokenStorage.getToken('trello');
  const trelloApiKey = options.trelloApiKey || process.env.TRELLO_API_KEY;
  if (trelloToken && trelloApiKey) {
    console.log('📌 Trelloから情報を収集中...');
    try {
      const trelloService = new TrelloService(trelloToken, trelloApiKey);
      reportData.trello.completedTasks = await trelloService.getCompletedTasks(dateRange);
      reportData.trello.createdTasks = await trelloService.getCreatedTasks(dateRange);
      reportData.trello.comments = await trelloService.getComments(dateRange);
      console.log(`  ✓ 完了:${reportData.trello.completedTasks.length}件、作成:${reportData.trello.createdTasks.length}件、コメント:${reportData.trello.comments.length}件`);
    } catch (error) {
      console.error('  ✗ Trelloの取得に失敗:', error);
    }
  } else {
    console.log('⚠️  Trello: トークンまたはAPIキーが設定されていません (スキップ)');
  }

  // レポート生成
  console.log('\n📝 レポートを生成中...');
  const report = renderer.render(reportData);

  // 要約生成(オプション)
  let summaryText = '';
  if (options.summarize) {
    console.log('\n🤖 要約を生成中...');
    
    try {
      if (options.summaryApi && options.summaryApiKey) {
        // API要約
        const apiSummarizer = new ApiSummarizer({
          provider: options.summaryApi,
          apiKey: options.summaryApiKey,
          model: options.summaryModel,
        });
        const summary = await apiSummarizer.summarize(reportData);
        summaryText = '\n## 📊 3行要約 (AI生成)\n\n' + 
          summary.map((line, i) => `${i + 1}. ${line}`).join('\n') + '\n\n';
        console.log('  ✓ AI要約が完了しました');
      } else {
        // ローカル要約
        const localSummarizer = new LocalSummarizer();
        const result = localSummarizer.summarize(reportData);
        summaryText = '\n## 📊 3行要約\n\n' + 
          result.threeLineSummary.map((line, i) => `${i + 1}. ${line}`).join('\n') + '\n\n';
        
        // キーワード抽出
        const sentences = [
          ...reportData.git.commits.map(c => c.message),
          ...reportData.github.commits.map(c => c.message),
        ];
        const keywords = localSummarizer.extractKeywords(sentences, 5);
        if (keywords.length > 0) {
          summaryText += `**キーワード**: ${keywords.join(', ')}\n\n`;
        }
        
        console.log('  ✓ ローカル要約が完了しました');
      }
    } catch (error) {
      console.error('  ✗ 要約生成に失敗:', error);
      summaryText = '\n## 📊 3行要約\n\n要約の生成に失敗しました。\n\n';
    }
  }

  // 要約を先頭に追加
  const finalReport = summaryText ? summaryText + report : report;

  // 出力
  const outputPath = options.output || path.join(process.cwd(), `daily-report-${dateStr}.md`);
  fs.writeFileSync(outputPath, finalReport, 'utf-8');

  console.log(`\n✅ 日報を生成しました: ${outputPath}`);
  
  if (options.summarize) {
    console.log('\n📊 要約:');
    console.log(summaryText);
  }
}
