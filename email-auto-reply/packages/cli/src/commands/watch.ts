import { Command } from 'commander';
import chalk from 'chalk';
import { processEmails } from '../services/reply.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { ServiceType } from '@email-reply/core';

// node-cron は型情報が不安定なため require で読み込む
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cron = require('node-cron') as typeof import('node-cron');

export const watchCommand = new Command('watch')
  .description('cronで定期的にメールをチェックして自動返信する')
  .argument('[service]', 'サービス: gmail / yahoo / all', 'all')
  .option('-s, --schedule <cron>', 'cron スケジュール式', config.cronSchedule)
  .option('--once', '最初の1回だけ実行して終了する')
  .action(async (service: string, opts) => {
    if (!['gmail', 'yahoo', 'all'].includes(service)) {
      logger.error(`無効なサービス: ${service}`); process.exit(1);
    }
    if (!cron.validate(opts.schedule)) {
      logger.error(`無効なcronスケジュール: ${opts.schedule}`); process.exit(1);
    }

    console.log(chalk.bold('\n🔄 自動返信ウォッチモード\n'));
    console.log(`  サービス     : ${chalk.cyan(service)}`);
    console.log(`  スケジュール : ${chalk.cyan(opts.schedule)}`);
    console.log(`  AIプロバイダ : ${chalk.cyan(config.aiProvider)}`);
    console.log(chalk.gray('\nCtrl+C で停止\n'));

    logger.info('初回チェックを実行します...');
    await run(service as ServiceType);

    if (opts.once) { logger.info('--once により終了'); process.exit(0); }

    const job = cron.schedule(opts.schedule, async () => {
      logger.info(`cronチェック [${new Date().toLocaleString('ja-JP')}]`);
      await run(service as ServiceType);
    });

    process.on('SIGINT',  () => { job.stop(); console.log(''); logger.info('停止します'); process.exit(0); });
    process.on('SIGTERM', () => { job.stop(); process.exit(0); });
  });

async function run(service: ServiceType) {
  try { await processEmails(service); }
  catch (err) { logger.error(`エラー: ${err instanceof Error ? err.message : String(err)}`); }
}
