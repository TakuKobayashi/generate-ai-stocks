import { Env, KV_KEYS } from "../types";
import {
  fetchGitHubReadme,
  parseMarkdownTables,
  selectTargetTable,
} from "../lib/github";

export async function handleCron(env: Env): Promise<void> {
  console.log("[cron] Starting README fetch job");

  try {
    const markdown = await fetchGitHubReadme(
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME
    );

    const tables = parseMarkdownTables(markdown);
    console.log(`[cron] Found ${tables.length} table(s) in README`);

    const targetTable = selectTargetTable(tables);

    if (!targetTable) {
      console.warn("[cron] No target table found in README");
      return;
    }

    const payload = {
      fetchedAt: new Date().toISOString(),
      repo: `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`,
      table: targetTable,
    };

    await env.KV.put(KV_KEYS.README_TABLE, JSON.stringify(payload));
    await env.KV.put(KV_KEYS.README_LAST_FETCHED, new Date().toISOString());

    console.log(
      `[cron] Stored table with ${targetTable.rows.length} rows into KV`
    );
  } catch (error) {
    console.error("[cron] Failed to fetch/store README:", error);
    throw error;
  }
}
