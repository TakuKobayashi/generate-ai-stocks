#!/usr/bin/env node
import { program } from "commander";
import { config as loadDotenv } from "dotenv";
import chalk from "chalk";

// Load .env at startup
loadDotenv();

import { initCommand } from "./commands/init.js";
import { authCommand } from "./commands/auth.js";
import { collectCommand } from "./commands/collect.js";
import { draftCommand } from "./commands/draft.js";
import { publishCommand } from "./commands/publish.js";

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log("");
  console.log(chalk.bold.cyan("  ◆ SignalForge"));
  console.log(chalk.dim("  Developer Branding Infrastructure"));
  console.log("");
}

// ─── Program ──────────────────────────────────────────────────────────────────

program
  .name("signalforge")
  .description(
    "Transform your engineering activity logs into authentic developer brand content."
  )
  .version("0.1.0")
  .addHelpText(
    "before",
    `${chalk.bold.cyan("◆ SignalForge")} ${chalk.dim("— Developer Branding Infrastructure")}\n`
  );

// ─── init ─────────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Initialize SignalForge in the current directory")
  .action(async () => {
    printBanner();
    await initCommand();
  });

// ─── auth ─────────────────────────────────────────────────────────────────────

const authCmd = program
  .command("auth")
  .description("Authenticate with source/publish providers");

authCmd
  .command("github")
  .description("Set up GitHub authentication")
  .action(async () => {
    printBanner();
    await authCommand("github");
  });

authCmd
  .command("asana")
  .description("Set up Asana authentication")
  .action(async () => {
    printBanner();
    await authCommand("asana");
  });

authCmd
  .command("slack")
  .description("Set up Slack authentication")
  .action(async () => {
    printBanner();
    await authCommand("slack");
  });

// ─── collect ──────────────────────────────────────────────────────────────────

program
  .command("collect")
  .description("Collect activity logs from configured sources")
  .option("-c, --config <path>", "Path to signalforge.yml", "./signalforge.yml")
  .option("-o, --output <dir>", "Output directory for raw logs", ".signalforge")
  .action(async (options: { config: string; output?: string }) => {
    printBanner();
    try {
      await collectCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  ✗ ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

// ─── draft ────────────────────────────────────────────────────────────────────

program
  .command("draft")
  .description("Generate SNS drafts from activity logs using AI")
  .option("-c, --config <path>", "Path to signalforge.yml", "./signalforge.yml")
  .option("-v, --variants <n>", "Number of variants per target (overrides config)")
  .option("-l, --logs <file>", "Path to specific logs JSON file")
  .action(
    async (options: { config: string; variants?: string; logs?: string }) => {
      printBanner();
      try {
        await draftCommand({
          config: options.config,
          variants: options.variants,
          logsFile: options.logs,
        });
      } catch (err) {
        console.error(chalk.red(`\n  ✗ ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    }
  );

// ─── publish ──────────────────────────────────────────────────────────────────

program
  .command("publish")
  .description("Interactively select and export drafts to output/")
  .option("-c, --config <path>", "Path to signalforge.yml", "./signalforge.yml")
  .option("-d, --date <date>", "Date to publish drafts for (YYYY-MM-DD)")
  .action(async (options: { config: string; date?: string }) => {
    printBanner();
    try {
      await publishCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  ✗ ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

// ─── Parse ────────────────────────────────────────────────────────────────────

program.parse(process.argv);
