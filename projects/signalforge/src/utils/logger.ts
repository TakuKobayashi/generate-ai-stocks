import chalk from "chalk";

const PREFIX = chalk.bold.cyan("◆ SignalForge");

export const logger = {
  info: (msg: string) =>
    console.log(`${PREFIX} ${chalk.white(msg)}`),

  success: (msg: string) =>
    console.log(`${PREFIX} ${chalk.green("✓")} ${chalk.white(msg)}`),

  warn: (msg: string) =>
    console.log(`${PREFIX} ${chalk.yellow("⚠")} ${chalk.yellow(msg)}`),

  error: (msg: string) =>
    console.error(`${PREFIX} ${chalk.red("✗")} ${chalk.red(msg)}`),

  section: (title: string) => {
    console.log("");
    console.log(chalk.bold.magenta(`▸ ${title}`));
  },

  dim: (msg: string) =>
    console.log(`  ${chalk.dim(msg)}`),

  score: (label: string, value: number) => {
    const bar = "█".repeat(Math.round(value / 10)) + "░".repeat(10 - Math.round(value / 10));
    const color = value >= 80 ? chalk.green : value >= 60 ? chalk.yellow : chalk.red;
    console.log(`  ${chalk.dim(label.padEnd(20))} ${color(bar)} ${chalk.bold(value)}`);
  },
};
