#!/usr/bin/env tsx
/**
 * cli/index.ts
 * doc-scanner CLI — `npm run cli -- <command> [options]`
 *
 * コマンド一覧:
 *   ocr     <patterns..>   画像からテキストを抽出して .txt に保存
 *   scan    <patterns..>   ドキュメント輪郭補正して画像を保存
 *   process <patterns..>   スキャン + OCR 両方を一括処理（デフォルト）
 */

import { Command } from "commander";
import fg          from "fast-glob";
import * as path   from "path";
import * as fs     from "fs";
import { processFile }  from "../core/processor";
import type { OcrLanguage } from "../core/ocr";
import { SUPPORTED_FORMATS } from "../core/image";

// ─────────────────────────────────────────
// 共通オプション型
// ─────────────────────────────────────────

interface CommonOpts {
  output:  string;
  lang:    string;
  flat:    boolean;
  verbose: boolean;
}

// ─────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────

async function resolveImages(patterns: string[]): Promise<string[]> {
  const files = await fg(patterns, {
    absolute:  true,
    onlyFiles: true,
    ignore:    ["**/node_modules/**", "**/dist/**"],
  });

  const unique = [...new Set(files)].filter((f) => {
    const ext = path.extname(f).toLowerCase().replace(".", "");
    return (SUPPORTED_FORMATS as string[]).includes(ext);
  });

  return unique;
}

function outputDirFor(
  inputPath: string,
  baseDir: string,
  flat: boolean,
  totalFiles: number
): string {
  if (flat || totalFiles === 1) return baseDir;
  const basename = path.basename(inputPath, path.extname(inputPath));
  return path.join(baseDir, basename);
}

function printBanner() {
  console.log("╔══════════════════════════════════╗");
  console.log("║        doc-scanner  CLI          ║");
  console.log("╚══════════════════════════════════╝");
  console.log();
}

function validateLang(lang: string): OcrLanguage {
  const valid: OcrLanguage[] = ["jpn", "eng", "jpn+eng"];
  if (!valid.includes(lang as OcrLanguage)) {
    console.error(`❌ 無効な言語指定 "${lang}". 使用可能: jpn, eng, jpn+eng`);
    process.exit(1);
  }
  return lang as OcrLanguage;
}

// ─────────────────────────────────────────
// 処理実行ループ（コマンド共通）
// ─────────────────────────────────────────

async function runProcess(
  patterns: string[],
  opts: CommonOpts & { skipScan: boolean; skipOcr: boolean }
) {
  printBanner();

  const files = await resolveImages(patterns);
  if (files.length === 0) {
    console.error("❌ 処理対象の画像ファイルが見つかりませんでした。");
    console.error(`   対応フォーマット: ${SUPPORTED_FORMATS.join(", ")}`);
    process.exit(1);
  }

  const lang = validateLang(opts.lang);

  console.log(`📁 処理対象  : ${files.length} ファイル`);
  console.log(`📂 出力先   : ${path.resolve(opts.output)}`);
  console.log(`🌐 OCR 言語 : ${lang}`);
  if (opts.skipScan) console.log("⏭️  スキャン  : スキップ");
  if (opts.skipOcr)  console.log("⏭️  OCR      : スキップ");
  console.log();

  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const rel      = path.relative(process.cwd(), filePath);
    console.log(`[${i + 1}/${files.length}] 📄 ${rel}`);

    const outDir = outputDirFor(filePath, opts.output, opts.flat, files.length);

    const result = await processFile(filePath, {
      outputDir: outDir,
      lang,
      skipScan:  opts.skipScan,
      skipOcr:   opts.skipOcr,
      onProgress: (phase, pct) => {
        if (opts.verbose && pct % 20 === 0) {
          process.stdout.write(`\r  ${phase === "ocr" ? "🔍 OCR" : "📐 Scan"} 進捗: ${pct}%   `);
        }
      },
    });

    if (opts.verbose && (!opts.skipOcr || !opts.skipScan)) {
      process.stdout.write("\n");
    }

    const ok = result.scanSuccess || result.ocrSuccess;
    if (ok) {
      successCount++;
      if (result.scanOutputPath) {
        console.log(`  🖼️  ${path.relative(process.cwd(), result.scanOutputPath)}`);
      }
      if (result.ocrOutputPath) {
        const conf = result.ocrConfidence?.toFixed(1) ?? "?";
        console.log(`  📝 ${path.relative(process.cwd(), result.ocrOutputPath)} (信頼度: ${conf}%)`);
      }
    } else {
      failCount++;
      console.log("  ❌ 処理失敗");
    }

    if (result.errors.length > 0) {
      result.errors.forEach((e) => console.log(`  ⚠️  ${e}`));
    }
    console.log();
  }

  console.log("═".repeat(44));
  console.log(`📊 完了: 成功 ${successCount} / ${files.length} ファイル`);
  if (failCount > 0) console.log(`   失敗: ${failCount} ファイル`);
  console.log(`📂 出力先: ${path.resolve(opts.output)}`);
}

// ─────────────────────────────────────────
// 共通オプション定義（各サブコマンドに追加）
// ─────────────────────────────────────────

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("-o, --output <dir>",  "出力ディレクトリ",                     "./output")
    .option("-l, --lang   <lang>", "OCR 言語 (jpn / eng / jpn+eng)",      "jpn+eng")
    .option("--flat",              "フラットに出力（サブディレクトリなし）", false)
    .option("-v, --verbose",       "詳細ログを表示",                        false);
}

// ─────────────────────────────────────────
// CLI 定義
// ─────────────────────────────────────────

const program = new Command();

program
  .name("doc-scanner")
  .description("画像から日本語/英語テキストをOCRで抽出し、ドキュメントスキャン補正を行うCLIツール")
  .version("1.0.0");

// ── process（デフォルト: スキャン + OCR） ──────────────
addCommonOptions(
  program
    .command("process <patterns...>", { isDefault: true })
    .description("ドキュメントスキャン補正 + OCR テキスト抽出を一括処理（デフォルト）")
    .option("--skip-scan", "スキャン補正をスキップ", false)
    .option("--skip-ocr",  "OCR 処理をスキップ",    false)
).action(async (patterns: string[], opts: CommonOpts & { skipScan: boolean; skipOcr: boolean }) => {
  await runProcess(patterns, opts);
});

// ── ocr（OCR のみ） ────────────────────────────────────
addCommonOptions(
  program
    .command("ocr <patterns...>")
    .description("OCR テキスト抽出のみ実行（スキャン補正なし）")
).action(async (patterns: string[], opts: CommonOpts) => {
  await runProcess(patterns, { ...opts, skipScan: true, skipOcr: false });
});

// ── scan（スキャン補正のみ） ──────────────────────────
addCommonOptions(
  program
    .command("scan <patterns...>")
    .description("ドキュメントスキャン補正のみ実行（OCR なし）")
).action(async (patterns: string[], opts: CommonOpts) => {
  await runProcess(patterns, { ...opts, skipScan: false, skipOcr: true });
});

program.addHelpText("after", `
使用例:
  $ npm run cli -- process "*.jpg"
  $ npm run cli -- process "photos/**/*.png" -o ./results -l jpn -v
  $ npm run cli -- ocr "scan*.jpg" -l eng
  $ npm run cli -- scan "doc*.png" -o ./scanned --flat
  $ npm run cli -- process "*.jpg" --skip-scan   # OCR のみ
  $ npm run cli -- process "*.jpg" --skip-ocr    # スキャン補正のみ
`);

program.parse(process.argv);
