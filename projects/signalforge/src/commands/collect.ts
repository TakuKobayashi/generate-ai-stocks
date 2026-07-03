import fs from "fs";
import path from "path";
import { loadConfig } from "../utils/config.js";
import { runCollectors } from "../collectors/index.js";
import { sanitizeLogs } from "../utils/sanitizer.js";
import { todayString } from "../utils/date.js";
import { logger } from "../utils/logger.js";
import chalk from "chalk";

type CollectOptions = {
  config: string;
  output?: string;
};

export async function collectCommand(options: CollectOptions): Promise<void> {
  logger.section("Collecting activity logs");

  // Load & validate config
  const config = loadConfig(options.config);
  logger.success(`Loaded config for ${chalk.bold(config.profile.name)}`);

  // Run all available collectors
  const rawLogs = await runCollectors(config);

  if (rawLogs.length === 0) {
    logger.warn("No activity logs collected. Check your sources in signalforge.yml.");
    return;
  }

  // Sanitize
  const logs = sanitizeLogs(rawLogs, config);
  const sensitiveCount = rawLogs.length - logs.filter((l) => !l.sensitive).length;
  if (sensitiveCount > 0) {
    logger.dim(`Sanitized ${sensitiveCount} sensitive entries`);
  }

  // Write normalized logs
  const date = todayString();
  const outputDir = options.output
    ? path.resolve(options.output)
    : path.resolve(".signalforge");

  fs.mkdirSync(outputDir, { recursive: true });

  const logsPath = path.join(outputDir, `logs_${date}.json`);
  fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2), "utf-8");

  logger.success(
    `${logs.length} activit${logs.length === 1 ? "y" : "ies"} saved → ${path.relative(process.cwd(), logsPath)}`
  );

  // Print summary
  console.log("");
  logger.section("Activity Summary");

  const bySouce = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.source] = (acc[log.source] ?? 0) + 1;
    return acc;
  }, {});

  for (const [source, count] of Object.entries(bySouce)) {
    logger.dim(`${source.padEnd(16)} ${count} entries`);
  }

  console.log("");
  console.log(chalk.dim(`  Next: signalforge draft --config ${options.config}`));
}
