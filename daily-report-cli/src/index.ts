#!/usr/bin/env node

import { Command } from 'commander';
import { authGitHub } from './commands/auth/github';
import { authAsana, authGoogleTasks, authTrello } from './commands/auth/other-services';
import { generateReport } from './commands/generate';
import { tokenStorage } from './storage/token-storage';

const program = new Command();

program
  .name('daily-report')
  .description('エンジニア向け日報自動生成CLIツール')
  .version('1.0.0');

// 認証コマンド
const authCommand = program
  .command('auth')
  .description('各サービスのOAuth認証を行います');

authCommand
  .command('github')
  .description('GitHub認証')
  .action(async () => {
    try {
      await authGitHub();
    } catch (error) {
      console.error('認証に失敗しました:', error);
      process.exit(1);
    }
  });

authCommand
  .command('asana')
  .description('Asana認証')
  .action(async () => {
    try {
      await authAsana();
    } catch (error) {
      console.error('認証に失敗しました:', error);
      process.exit(1);
    }
  });

authCommand
  .command('google-tasks')
  .description('Google Tasks認証')
  .action(async () => {
    try {
      await authGoogleTasks();
    } catch (error) {
      console.error('認証に失敗しました:', error);
      process.exit(1);
    }
  });

authCommand
  .command('trello')
  .description('Trello認証')
  .action(async () => {
    try {
      await authTrello();
    } catch (error) {
      console.error('認証に失敗しました:', error);
      process.exit(1);
    }
  });

authCommand
  .command('status')
  .description('認証状態を確認')
  .action(() => {
    const tokens = tokenStorage.getAllTokens();
    console.log('=== 認証状態 ===');
    console.log(`GitHub:       ${tokens.github ? '✓ 認証済み' : '✗ 未認証'}`);
    console.log(`Asana:        ${tokens.asana ? '✓ 認証済み' : '✗ 未認証'}`);
    console.log(`Google Tasks: ${tokens.googleTasks ? '✓ 認証済み' : '✗ 未認証'}`);
    console.log(`Trello:       ${tokens.trello ? '✓ 認証済み' : '✗ 未認証'}`);
  });

// 日報生成コマンド
program
  .command('generate')
  .description('日報を生成します')
  .option('-t, --template <path>', 'テンプレートファイルのパス')
  .option('-o, --output <path>', '出力ファイルのパス')
  .option('--github-token <token>', 'GitHubアクセストークン')
  .option('--asana-token <token>', 'Asanaアクセストークン')
  .option('--google-tasks-token <token>', 'Google Tasksアクセストークン')
  .option('--trello-token <token>', 'Trelloアクセストークン')
  .option('--trello-api-key <key>', 'Trello APIキー')
  .option('-d, --date <date>', '対象日(YYYY-MM-DD形式、デフォルトは今日)')
  .option('-s, --summarize', '3行要約を生成する')
  .option('--summary-api <provider>', 'AI要約プロバイダー(openai/anthropic)')
  .option('--summary-api-key <key>', 'AI要約APIキー')
  .option('--summary-model <model>', 'AI要約モデル名')
  .action(async (options) => {
    try {
      await generateReport(options);
    } catch (error) {
      console.error('日報生成に失敗しました:', error);
      process.exit(1);
    }
  });

// initコマンド(テンプレート初期化)
program
  .command('init')
  .description('デフォルトテンプレートを作成します')
  .option('-p, --path <path>', 'テンプレートの出力先', './template.md')
  .action((options) => {
    const { createDefaultTemplate } = require('./template/renderer');
    createDefaultTemplate(options.path);
    console.log(`✓ デフォルトテンプレートを作成しました: ${options.path}`);
  });

program.parse(process.argv);
