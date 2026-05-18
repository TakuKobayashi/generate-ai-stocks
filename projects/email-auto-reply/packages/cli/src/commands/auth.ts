import { Command } from 'commander';
import chalk from 'chalk';
import { authenticateGmail, loadGmailToken } from '../services/gmail.js';
import { logger } from '../utils/logger.js';

export const authCommand = new Command('auth')
  .description('各サービスの認証を管理する')
  .addCommand(
    new Command('gmail')
      .description('GmailのOAuth2認証を実行する')
      .option('--check', '認証状態を確認する')
      .action(async (opts) => {
        if (opts.check) {
          const token = loadGmailToken();
          if (token) logger.success('Gmail: 認証済みです ✓');
          else        logger.warn('Gmail: 未認証です。`email-reply auth gmail` で認証してください');
          return;
        }
        console.log(chalk.bold('\n📧 Gmail OAuth2 認証\n'));
        console.log('事前に Google Cloud Console で以下を設定してください:');
        console.log('  1. プロジェクト作成 → Gmail API を有効化');
        console.log('  2. OAuth 2.0 クライアントID を作成（デスクトップアプリ）');
        console.log('  3. .env に GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET を設定\n');
        try {
          await authenticateGmail();
          logger.success('Gmail認証が完了しました！');
        } catch (err) {
          logger.error(`認証エラー: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('yahoo')
      .description('Yahoo Mail の設定ガイドを表示する')
      .action(() => {
        console.log(chalk.bold('\n📧 Yahoo Japan Mail 設定\n'));
        console.log('  1. https://login.yahoo.co.jp/ にログイン');
        console.log('  2. アカウント情報 → セキュリティ → アプリパスワードを生成');
        console.log('  3. Yahooメール設定 → POP/IMAP → IMAP を有効化');
        console.log('  4. .env に YAHOO_EMAIL / YAHOO_APP_PASSWORD を設定\n');
      })
  );
