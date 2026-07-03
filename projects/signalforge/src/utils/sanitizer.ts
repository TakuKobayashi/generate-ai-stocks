import type { ActivityLog, SignalForgeConfig } from "../types/index.js";

// ─── Default Sensitive Patterns ───────────────────────────────────────────────

const DEFAULT_PATTERNS: Array<[RegExp, string]> = [
  // URLs
  [/https?:\/\/[^\s"']+/g, "[URL]"],
  // API keys / tokens (hex/base64-like long strings)
  [/\b[A-Za-z0-9_\-]{32,}\b/g, "[TOKEN]"],
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]"],
  // IPv4 addresses
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]"],
  // GitHub PAT format
  [/gh[pousr]_[A-Za-z0-9]{36,}/g, "[GITHUB_TOKEN]"],
  // Client / company name patterns will be user-configurable
];

// ─── Repo Name Abstraction ────────────────────────────────────────────────────

function abstractRepoName(repoPath: string): string {
  const parts = repoPath.replace(/\\/g, "/").split("/");
  const name = parts[parts.length - 1] ?? repoPath;
  // Remove org prefix if present (e.g. acme-corp/project-name → project-name)
  return name.replace(/^[a-z0-9-]+\//, "");
}

// ─── Core Sanitize ───────────────────────────────────────────────────────────

function sanitizeText(text: string, extraPatterns: RegExp[]): string {
  let result = text;

  for (const [pattern, replacement] of DEFAULT_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, pattern.flags), replacement);
  }

  for (const pattern of extraPatterns) {
    result = result.replace(pattern, "[REDACTED]");
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function sanitizeLogs(
  logs: ActivityLog[],
  config: SignalForgeConfig
): ActivityLog[] {
  if (!config.sanitize.enabled) return logs;

  const extraPatterns = (config.sanitize.patterns ?? []).map(
    (p) => new RegExp(p, "gi")
  );

  return logs.map((log) => ({
    ...log,
    title: sanitizeText(log.title, extraPatterns),
    summary: sanitizeText(log.summary, extraPatterns),
    tags: log.tags.map((t) => sanitizeText(t, extraPatterns)),
    sensitive: log.sensitive ?? false,
  }));
}

export { abstractRepoName };
