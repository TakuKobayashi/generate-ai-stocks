import simpleGit from "simple-git";
import path from "path";
import type { ActivityLog, Collector, SignalForgeConfig } from "../types/index.js";
import { daysAgo, formatDate } from "../utils/date.js";
import { abstractRepoName } from "../utils/sanitizer.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTags(message: string): string[] {
  const tags: string[] = [];

  // Detect conventional commit types
  const ccMatch = message.match(/^(feat|fix|refactor|docs|chore|test|style|perf|ci|build|revert)(\(.+\))?:/i);
  if (ccMatch?.[1]) tags.push(ccMatch[1].toLowerCase());

  // Extract #hashtags
  const hashTags = message.match(/#\w+/g) ?? [];
  tags.push(...hashTags.map((t) => t.slice(1)));

  // Detect keywords
  const keywords = ["API", "UI", "DB", "auth", "deploy", "migration", "performance", "security", "test", "refactor"];
  for (const kw of keywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(message)) {
      tags.push(kw.toLowerCase());
    }
  }

  return [...new Set(tags)];
}

function buildSummary(messages: string[]): string {
  if (messages.length === 0) return "";
  if (messages.length === 1) return messages[0] ?? "";
  return messages.slice(0, 5).join(" / ");
}

// ─── Collector ───────────────────────────────────────────────────────────────

export const localGitCollector: Collector = {
  name: "localGit",

  isAvailable(config: SignalForgeConfig): boolean {
    return (
      !!config.sources.localGit &&
      config.sources.localGit.repos.length > 0
    );
  },

  async collect(config: SignalForgeConfig): Promise<ActivityLog[]> {
    const { repos, daysBack = 7, branchFilter } =
      config.sources.localGit ?? { repos: [] };

    const logs: ActivityLog[] = [];
    const since = daysAgo(daysBack);

    for (const repoPath of repos) {
      const resolved = path.resolve(repoPath);
      const git = simpleGit(resolved);

      let commits;
      try {
        const logOptions: string[] = [
          `--since=${since.toISOString()}`,
          "--no-merges",
        ];
        if (branchFilter) logOptions.push(branchFilter);

        commits = await git.log(logOptions);
      } catch {
        // Repo might not exist or not be a git repo — skip silently
        continue;
      }

      // Group commits by day
      const byDay = new Map<string, string[]>();
      for (const commit of commits.all) {
        const day = formatDate(new Date(commit.date));
        const messages = byDay.get(day) ?? [];
        messages.push(commit.message);
        byDay.set(day, messages);
      }

      const repoName = abstractRepoName(resolved);

      for (const [day, messages] of byDay.entries()) {
        const allTags = messages.flatMap(extractTags);

        logs.push({
          source: "localGit",
          timestamp: `${day}T00:00:00.000Z`,
          title: `[${repoName}] ${messages.length} commit${messages.length > 1 ? "s" : ""}`,
          summary: buildSummary(messages),
          tags: [...new Set(["git", repoName, ...allTags])],
          metadata: {
            repo: repoName,
            commitCount: messages.length,
            messages,
          },
        });
      }
    }

    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },
};
