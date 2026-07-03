import fs from "fs";
import path from "path";
import { select, checkbox } from "@inquirer/prompts";
import { logger } from "../utils/logger.js";
import { todayString } from "../utils/date.js";
import chalk from "chalk";

type PublishOptions = {
  config: string;
  date?: string;
};

type DraftMeta = {
  id: string;
  date: string;
  target: string;
  language: string;
  variantIndex: number;
  title: string;
  score: { overall: number; linkedinScore: number; xScore: number; brandingScore: number };
};

function loadDraftMeta(metaPath: string): DraftMeta | null {
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as DraftMeta;
  } catch {
    return null;
  }
}

function findDrafts(draftsDir: string): Array<{ meta: DraftMeta; mdPath: string; metaPath: string }> {
  if (!fs.existsSync(draftsDir)) return [];

  return fs
    .readdirSync(draftsDir)
    .filter((f) => f.endsWith(".meta.json"))
    .map((f) => {
      const metaPath = path.join(draftsDir, f);
      const mdPath = metaPath.replace(".meta.json", ".md");
      const meta = loadDraftMeta(metaPath);
      return meta ? { meta, mdPath, metaPath } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.meta.score.overall - a.meta.score.overall);
}

function copyToOutput(
  mdPath: string,
  meta: DraftMeta,
  date: string
): string {
  const outputDir = path.resolve(
    "output",
    date,
    meta.target,
    meta.language
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const filename = `post_${meta.variantIndex + 1}_${meta.id}.md`;
  const destPath = path.join(outputDir, filename);
  fs.copyFileSync(mdPath, destPath);

  // Copy image if exists
  const imageGlob = mdPath.replace(".md", "").replace(/\.meta$/, "");
  for (const ext of [".jpg", ".png", ".jpeg", ".webp"]) {
    const imgSrc = imageGlob + "_image" + ext;
    if (fs.existsSync(imgSrc)) {
      const imgDest = path.join(outputDir, `image_${meta.variantIndex + 1}${ext}`);
      fs.copyFileSync(imgSrc, imgDest);
      break;
    }
  }

  return destPath;
}

export async function publishCommand(options: PublishOptions): Promise<void> {
  const date = options.date ?? todayString();
  const draftsDir = path.resolve("drafts", date);

  logger.section("Publish: Select drafts to export");

  const drafts = findDrafts(draftsDir);

  if (drafts.length === 0) {
    logger.warn(`No drafts found in drafts/${date}/`);
    logger.dim("Run `signalforge draft` first.");
    process.exit(1);
  }

  console.log(`\n  Found ${chalk.bold(drafts.length)} drafts for ${chalk.cyan(date)}:\n`);

  // Show top drafts
  for (const d of drafts.slice(0, 5)) {
    const score = d.meta.score.overall;
    const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    console.log(
      `  ${scoreColor(`[${score}]`)} ${chalk.bold(d.meta.target.padEnd(10))} ${chalk.dim(d.meta.language)} v${d.meta.variantIndex + 1}  ${chalk.white(d.meta.title.slice(0, 60))}`
    );
  }

  console.log("");

  // Interactive selection
  const choices = drafts.map((d) => ({
    name: `[${d.meta.score.overall}] ${d.meta.target}/${d.meta.language} v${d.meta.variantIndex + 1} — ${d.meta.title.slice(0, 50)}`,
    value: d,
    checked: d.meta.score.overall >= 75,
  }));

  const selected = await checkbox({
    message: "Select drafts to publish (space to toggle, enter to confirm):",
    choices,
  });

  if (selected.length === 0) {
    logger.warn("No drafts selected. Exiting.");
    return;
  }

  // Copy to output/
  logger.section("Exporting selected drafts");

  const exported: string[] = [];
  for (const draft of selected) {
    const dest = copyToOutput(draft.mdPath, draft.meta, date);
    exported.push(dest);
    logger.success(
      `${draft.meta.target}/${draft.meta.language} v${draft.meta.variantIndex + 1} → ${path.relative(process.cwd(), dest)}`
    );
  }

  console.log("");
  console.log(chalk.bold.green(`✨ ${exported.length} draft${exported.length === 1 ? "" : "s"} exported to output/${date}/`));
  console.log("");
  console.log(chalk.dim("  Your drafts are ready. Copy the content to your SNS of choice."));
  console.log(chalk.dim("  Native publish integrations coming in a future release."));
}
