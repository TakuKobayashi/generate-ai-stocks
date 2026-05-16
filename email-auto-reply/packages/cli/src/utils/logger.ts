import chalk from 'chalk';

const ts = () => new Date().toISOString();

export const logger = {
  info:    (msg: string) => console.log(chalk.cyan(`[${ts()}] [INFO] `)    + msg),
  success: (msg: string) => console.log(chalk.green(`[${ts()}] [✓] `)     + msg),
  warn:    (msg: string) => console.warn(chalk.yellow(`[${ts()}] [WARN] `) + msg),
  error:   (msg: string) => console.error(chalk.red(`[${ts()}] [ERROR] `)  + msg),
  step:    (msg: string) => console.log(chalk.blue(`  → `) + msg),
  debug:   (msg: string) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(chalk.gray(`[${ts()}] [DEBUG] `) + msg);
    }
  },
};
