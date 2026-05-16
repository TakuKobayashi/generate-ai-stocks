import { Command } from 'commander';
import chalk from 'chalk';
import { processEmails, listHistory } from '../services/reply.js';
import { logger } from '../utils/logger.js';
import type { ServiceType } from '@email-reply/core';

export const checkCommand = new Command('check')
  .description('メールをチェックして自動返信する（1回実行）')
  .argument('[service]', 'サービス: gmail / yahoo / all', 'all')
  .action(async (service: string) => {
    if (!['gmail', 'yahoo', 'all'].includes(service)) {
      logger.error(`無効なサービス: ${service}`); process.exit(1);
    }
    console.log(chalk.bold(`\n📬 メールチェック開始 [${service}]\n`));
    try {
      await processEmails(service as ServiceType);
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

export const historyCommand = new Command('history')
  .description('処理済みメールの履歴を表示する')
  .option('-n, --limit <number>', '表示件数', '20')
  .action(async (opts) => {
    const records = await listHistory(parseInt(opts.limit));
    if (records.length === 0) { logger.info('処理済みメールはありません'); return; }

    console.log(chalk.bold(`\n📋 処理済みメール履歴 (最新${opts.limit}件)\n`));
    for (const r of records) {
      const date = r.processedAt ? new Date(r.processedAt).toLocaleString('ja-JP') : '-';
      const svc  = r.service === 'gmail' ? chalk.blue('Gmail') : chalk.magenta('Yahoo');
      const st   = r.status === 'replied' ? chalk.green(r.status)
                 : r.status === 'error'   ? chalk.red(r.status)
                 : chalk.yellow(r.status);
      console.log(`${date}  ${svc}  ${st.padEnd(10)}  ${(r.fromAddress ?? '-').substring(0, 30).padEnd(32)}  ${(r.subject ?? '-').substring(0, 40)}`);
    }
    console.log('');
  });
