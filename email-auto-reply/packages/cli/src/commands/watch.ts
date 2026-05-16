import { Command } from 'commander';
import { Cron } from 'croner';
import chalk from 'chalk';
import { processEmails } from '../services/reply.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { ServiceType } from '../lib/index.js';

export const watchCommand = new Command('watch')
  .description('cronで定期的にメールをチェックして自動返信する')
  .argument('[service]', 'サービス: gmail / yahoo / all', 'all')
  .option('-s, --schedule <cron>', 'cron スケジュール式', config.cronSchedule)
  .option('--once', '最初の1回だけ実行して終了する')
  .action(async (service: string, opts) => {
    if (!['gmail', 'yahoo', 'all'].includes(service)) {
      logger.error(`無効なサービス: ${service}`); process.exit(1);
    }

    // croner でスケジュールの構文チェック
    try {
      new Cron(opts.schedule, { paused: true });
    } catch {
      logger.error(`無効なcronスケジュール: "${opts.schedule}"`);
      logger.info('例: "*/15 * * * *" (15分ごと)  "0 * * * *" (1時間ごと)');
      process.exit(1);
    }

    console.log(chalk.bold('\n🔄 自動返信ウォッチモード\n'));
    console.log(`  サービス     : ${chalk.cyan(service)}`);
    console.log(`  スケジュール : ${chalk.cyan(opts.schedule)}`);
    console.log(`  AIプロバイダ : ${chalk.cyan(config.aiProvider)}`);
    console.log(chalk.gray('\nCtrl+C で停止\n'));

    // 初回は即時実行
    logger.info('初回チェックを実行します...');
    await run(service as ServiceType);

    if (opts.once) { logger.info('--once により終了'); process.exit(0); }

    // croner でジョブを登録して定期実行
    const job = new Cron(opts.schedule, async () => {
      logger.info(`cronチェック [${new Date().toLocaleString('ja-JP')}]`);
      await run(service as ServiceType);
    });

    logger.info(`次回実行: ${job.nextRun()?.toLocaleString('ja-JP') ?? '-'}`);

    process.on('SIGINT', () => {
      job.stop();
      console.log('');
      logger.info('停止します');
      process.exit(0);
    });
    process.on('SIGTERM', () => { job.stop(); process.exit(0); });
  });

async function run(service: ServiceType): Promise<void> {
  try {
    await processEmails(service);
  } catch (err) {
    logger.error(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  }
}


