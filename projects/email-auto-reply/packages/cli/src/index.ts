#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
dotenv.config();

import { checkCommand, historyCommand } from './commands/check.js';
import { watchCommand } from './commands/watch.js';
import { authCommand } from './commands/auth.js';
import { config } from './config.js';

const program = new Command();

program
  .name('email-reply')
  .description(chalk.bold('📧 メール自動返信CLIツール') + '\n  Gmail / Yahoo Japan Mail 対応')
  .version('1.0.0');

program.addCommand(checkCommand);
program.addCommand(watchCommand);
program.addCommand(authCommand);
program.addCommand(historyCommand);

program
  .command('config')
  .description('現在の設定を表示する')
  .action(() => {
    console.log(chalk.bold('\n⚙️  現在の設定\n'));
    console.log(`  AIプロバイダー    : ${chalk.cyan(config.aiProvider)}`);
    console.log(`  データベース      : ${chalk.cyan(config.databaseUrl)}`);
    console.log(`  署名ファイル      : ${chalk.cyan(config.signatureFile)}`);
    console.log(`  Cronスケジュール  : ${chalk.cyan(config.cronSchedule)}`);
    console.log(chalk.bold('\n  Gmail'));
    console.log(`    ターゲットラベル : ${chalk.yellow(config.gmail.targetLabel)}`);
    console.log(`    クライアントID   : ${config.gmail.clientId ? chalk.green('設定済み') : chalk.red('未設定')}`);
    console.log(chalk.bold('\n  Yahoo Mail'));
    console.log(`    ターゲットフォルダ: ${chalk.yellow(config.yahoo.targetFolder)}`);
    console.log(`    メールアドレス   : ${config.yahoo.email ? chalk.green(config.yahoo.email) : chalk.red('未設定')}`);
    console.log('');
  });

program.parse(process.argv);
