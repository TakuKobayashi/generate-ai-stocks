import type { Collector, SignalForgeConfig, ActivityLog } from "../types/index.js";
import { localGitCollector } from "./localGit.js";
import { logger } from "../utils/logger.js";
import ora from "ora";

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new collectors here. Each must implement the Collector interface.

const REGISTRY: Collector[] = [
  localGitCollector,
  // githubCollector,   <- future
  // asanaCollector,    <- future
  // slackCollector,    <- future
  // notionCollector,   <- future
];

// ─── Run All Available Collectors ─────────────────────────────────────────────

export async function runCollectors(
  config: SignalForgeConfig
): Promise<ActivityLog[]> {
  const available = REGISTRY.filter((c) => c.isAvailable(config));

  if (available.length === 0) {
    logger.warn("No collectors are available. Check your signalforge.yml sources.");
    return [];
  }

  const allLogs: ActivityLog[] = [];

  for (const collector of available) {
    const spinner = ora({
      text: `Collecting from ${collector.name}...`,
      color: "cyan",
    }).start();

    try {
      const logs = await collector.collect(config);
      allLogs.push(...logs);
      spinner.succeed(
        `${collector.name}: collected ${logs.length} activit${logs.length === 1 ? "y" : "ies"}`
      );
    } catch (err) {
      spinner.fail(`${collector.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // De-duplicate by source+timestamp+title
  const seen = new Set<string>();
  return allLogs.filter((log) => {
    const key = `${log.source}::${log.timestamp}::${log.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Plugin Registration ──────────────────────────────────────────────────────

export function registerCollector(collector: Collector): void {
  if (REGISTRY.some((c) => c.name === collector.name)) {
    throw new Error(`Collector '${collector.name}' is already registered.`);
  }
  REGISTRY.push(collector);
}
