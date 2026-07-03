import fs from "fs";
import path from "path";
import { loadConfig } from "../utils/config.js";
import { runCollectors } from "../collectors/index.js";
import { sanitizeLogs } from "../utils/sanitizer.js";
import { generateDrafts } from "../generators/index.js";
import { todayString } from "../utils/date.js";
import { logger } from "../utils/logger.js";
import chalk from "chalk";
import type { ActivityLog } from "../types/index.js";

type DraftOptions = {
  config: string;
  variants?: string;
  logsFile?: string;
};

export async function draftCommand(options: DraftOptions): Promise<void> {
  logger.section("Generating SNS drafts");

  const config = loadConfig(options.config);

  // Override variants if provided via CLI
  if (options.variants) {
    const v = parseInt(options.variants, 10);
    if (!isNaN(v) && v > 0) {
      config.draft.variants = Math.min(v, 5);
    }
  }

  logger.success(`Profile: ${chalk.bold(config.profile.name)} (${config.profile.role})`);
  logger.dim(`Targets: ${config.targets.join(", ")}`);
  logger.dim(`Languages: ${config.publish.languages.join(", ")}`);
  logger.dim(`Variants: ${config.draft.variants}`);
  logger.dim(`AI: ${config.ai.provider}`);

  // Load activity logs: from file if provided, else re-collect
  let logs: ActivityLog[];

  if (options.logsFile) {
    const logsPath = path.resolve(options.logsFile);
    if (!fs.existsSync(logsPath)) {
      logger.error(`Logs file not found: ${logsPath}`);
      process.exit(1);
    }
    logs = JSON.parse(fs.readFileSync(logsPath, "utf-8")) as ActivityLog[];
    logger.success(`Loaded ${logs.length} activities from ${path.basename(logsPath)}`);
  } else {
    // Try to load from today's cache
    const cachedPath = path.resolve(".signalforge", `logs_${todayString()}.json`);
    if (fs.existsSync(cachedPath)) {
      logs = JSON.parse(fs.readFileSync(cachedPath, "utf-8")) as ActivityLog[];
      logger.success(`Using cached logs (${logs.length} activities)`);
    } else {
      logger.info("No cached logs found — collecting now...");
      const rawLogs = await runCollectors(config);
      logs = sanitizeLogs(rawLogs, config);
    }
  }

  if (logs.length === 0) {
    logger.warn("No activity logs available. Run `signalforge collect` first.");
    process.exit(1);
  }

  // Generate
  const { draftsDir, count } = await generateDrafts(logs, config);

  console.log("");
  console.log(chalk.bold.green(`✨ Generated ${count} draft${count === 1 ? "" : "s"}`));
  console.log(chalk.dim(`   → ${path.relative(process.cwd(), draftsDir)}/`));
  console.log("");
  console.log(chalk.dim("  Review drafts, then run: signalforge publish"));
}
