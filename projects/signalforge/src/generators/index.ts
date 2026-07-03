import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  ActivityLog,
  Draft,
  Language,
  PublishTarget,
  SignalForgeConfig,
} from "../types/index.js";
import { createAIProvider } from "../providers/index.js";
import { buildDraftPrompt, buildSystemPrompt } from "../prompts/index.js";
import { scoreDraft } from "../scoring/index.js";
import { fetchMediaForDraft } from "../media/index.js";
import { todayString } from "../utils/date.js";
import { logger } from "../utils/logger.js";
import ora from "ora";

// ─── Draft ID ─────────────────────────────────────────────────────────────────

function generateDraftId(): string {
  return crypto.randomBytes(4).toString("hex");
}

// ─── Markdown Serializer ──────────────────────────────────────────────────────

function draftToMarkdown(draft: Draft): string {
  const scoreBlock = `
## Scores
| Metric | Score |
|--------|-------|
| LinkedIn | ${draft.score.linkedinScore}/100 |
| X (Twitter) | ${draft.score.xScore}/100 |
| Technical | ${draft.score.technicalScore}/100 |
| Virality | ${draft.score.viralityScore}/100 |
| Branding | ${draft.score.brandingScore}/100 |
| **Overall** | **${draft.score.overall}/100** |
`.trim();

  const mediaBlock = draft.media
    ? `\n## Media\n- Query: \`${draft.media.query}\`\n- File: \`${path.basename(draft.media.localPath ?? draft.media.url)}\`\n- Attribution: ${draft.media.attribution ?? "N/A"}`
    : "";

  const sourceBlock = `
## Source Activities
${draft.sourceActivities.map((a) => `- **${a.source}** (${a.timestamp.slice(0, 10)}): ${a.title}`).join("\n")}
`.trim();

  return `---
id: ${draft.id}
date: ${draft.date}
target: ${draft.target}
language: ${draft.language}
variant: ${draft.variantIndex + 1}
overall_score: ${draft.score.overall}
created_at: ${draft.createdAt}
---

# ${draft.title}

## Post Content

${draft.body}

---

${scoreBlock}
${mediaBlock}

${sourceBlock}
`;
}

// ─── Meta JSON ────────────────────────────────────────────────────────────────

function draftToMeta(draft: Draft): Record<string, unknown> {
  return {
    id: draft.id,
    date: draft.date,
    target: draft.target,
    language: draft.language,
    variantIndex: draft.variantIndex,
    title: draft.title,
    tags: draft.tags,
    score: draft.score,
    media: draft.media
      ? {
          query: draft.media.query,
          url: draft.media.url,
          localPath: draft.media.localPath,
          attribution: draft.media.attribution,
        }
      : null,
    sourceCount: draft.sourceActivities.length,
    createdAt: draft.createdAt,
  };
}

// ─── Extract Title ────────────────────────────────────────────────────────────

function extractTitle(body: string, target: PublishTarget, language: Language): string {
  // Try to grab first line if it looks like a title
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  if (firstLine.length > 0 && firstLine.length <= 100) {
    return firstLine.replace(/^#+\s*/, "").replace(/[*_]/g, "");
  }
  return `${target} post (${language})`;
}

// ─── Extract Tags ─────────────────────────────────────────────────────────────

function extractHashtags(body: string): string[] {
  return [...new Set((body.match(/#\w+/g) ?? []).map((t) => t.slice(1)))];
}

// ─── Generate All Drafts ──────────────────────────────────────────────────────

export async function generateDrafts(
  logs: ActivityLog[],
  config: SignalForgeConfig
): Promise<{ draftsDir: string; count: number }> {
  const date = todayString();
  const draftsDir = path.resolve("drafts", date);
  fs.mkdirSync(draftsDir, { recursive: true });

  const ai = createAIProvider(config);
  const systemPrompt = buildSystemPrompt(config.profile);

  const { variants } = config.draft;
  const { targets, publish: { languages } } = config;

  logger.section("Generating drafts");

  let count = 0;

  for (const target of targets) {
    for (const language of languages) {
      for (let variantIndex = 0; variantIndex < variants; variantIndex++) {
        const spinnerLabel = `${target}/${language} variant ${variantIndex + 1}/${variants}`;
        const spinner = ora({ text: `Drafting ${spinnerLabel}...`, color: "magenta" }).start();

        try {
          // 1. Generate post content
          const prompt = buildDraftPrompt(logs, target, language, variantIndex);
          const body = await ai.complete(prompt, systemPrompt);

          // 2. Score the draft
          const score = await scoreDraft(body, target, ai);

          // 3. Fetch media if enabled
          const draftId = generateDraftId();
          const baseFilename = `draft_${target}_${language}_v${variantIndex + 1}_${draftId}`;
          const mediaAsset = config.media.enabled
            ? await fetchMediaForDraft(
                logs,
                target,
                draftsDir,
                `${baseFilename}_image`,
                ai,
                config
              )
            : undefined;

          // 4. Build draft object
          const draft: Draft = {
            id: draftId,
            date,
            variantIndex,
            language,
            target,
            title: extractTitle(body, target, language),
            body,
            tags: extractHashtags(body),
            score,
            media: mediaAsset,
            sourceActivities: logs,
            createdAt: new Date().toISOString(),
          };

          // 5. Write markdown
          const mdPath = path.join(draftsDir, `${baseFilename}.md`);
          fs.writeFileSync(mdPath, draftToMarkdown(draft), "utf-8");

          // 6. Write meta JSON
          const metaPath = path.join(draftsDir, `${baseFilename}.meta.json`);
          fs.writeFileSync(metaPath, JSON.stringify(draftToMeta(draft), null, 2), "utf-8");

          count++;
          spinner.succeed(
            `${spinnerLabel} → score: ${score.overall}/100`
          );

          logger.score("  LinkedIn", score.linkedinScore);
          logger.score("  Branding", score.brandingScore);

        } catch (err) {
          spinner.fail(`${spinnerLabel}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  return { draftsDir, count };
}
