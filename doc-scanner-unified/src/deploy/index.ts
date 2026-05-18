#!/usr/bin/env tsx
/**
 * deploy/index.ts
 * Cloud Run へのデプロイスクリプト（Windows / macOS / Linux 共通）
 * 実行: npm run deploy -- [options]
 */

import { execSync, spawnSync, SpawnSyncReturns } from "child_process";
import * as path from "path";
import * as fs   from "fs";
import { Command } from "commander";

// ─────────────────────────────────────────
// カラーログ（ANSI / Windows 両対応）
// ─────────────────────────────────────────

const supportsColor = process.platform !== "win32" || process.env.TERM === "xterm";
const c = {
  reset:  supportsColor ? "\x1b[0m"  : "",
  blue:   supportsColor ? "\x1b[34m" : "",
  green:  supportsColor ? "\x1b[32m" : "",
  yellow: supportsColor ? "\x1b[33m" : "",
  red:    supportsColor ? "\x1b[31m" : "",
  bold:   supportsColor ? "\x1b[1m"  : "",
};

const log = {
  info:  (...a: string[]) => console.log(`${c.blue}[INFO]${c.reset}  ${a.join(" ")}`),
  ok:    (...a: string[]) => console.log(`${c.green}[OK]${c.reset}    ${a.join(" ")}`),
  warn:  (...a: string[]) => console.log(`${c.yellow}[WARN]${c.reset}  ${a.join(" ")}`),
  error: (...a: string[]) => console.error(`${c.red}[ERROR]${c.reset} ${a.join(" ")}`),
  step:  (n: number, total: number, msg: string) =>
    console.log(`\n${c.bold}[${n}/${total}]${c.reset} ${msg}`),
};

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────

/** gcloud コマンドをスポーンして stdout を返す（エラー時は throw） */
function gcloud(args: string[], label?: string): string {
  const cmd  = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
  const desc = label ?? args.slice(0, 3).join(" ");

  log.info(`gcloud ${desc}...`);

  const result: SpawnSyncReturns<Buffer> = spawnSync(cmd, args, {
    stdio:    ["inherit", "pipe", "pipe"],
    encoding: "buffer",
    shell:    process.platform === "win32",
  });

  if (result.error) {
    // PATH にない場合
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      log.error("gcloud CLI が見つかりません。");
      log.error("インストール: https://cloud.google.com/sdk/docs/install");
      process.exit(1);
    }
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.toString("utf8").trim() ?? "";
    throw new Error(`gcloud ${desc} failed (exit ${result.status})\n${stderr}`);
  }

  return result.stdout?.toString("utf8").trim() ?? "";
}

/** gcloud の存在確認 */
function assertGcloud(): void {
  const cmd = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
  const r = spawnSync(cmd, ["version"], {
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  if (r.error || r.status !== 0) {
    log.error("gcloud CLI が見つかりません。");
    log.error("インストール: https://cloud.google.com/sdk/docs/install");
    log.error("インストール後に: gcloud auth login && gcloud config set project PROJECT_ID");
    process.exit(1);
  }
}

/** gcloud config から現在のプロジェクト ID を取得 */
function getCurrentProject(): string {
  try {
    return gcloud(["config", "get-value", "project"], "config get-value project");
  } catch {
    return "";
  }
}

/** Cloud Run サービスの URL を取得 */
function getServiceUrl(serviceName: string, region: string, project: string): string {
  try {
    return gcloud([
      "run", "services", "describe", serviceName,
      "--platform", "managed",
      "--region",   region,
      "--project",  project,
      "--format",   "value(status.url)",
    ], "services describe");
  } catch {
    return "(URL の取得に失敗)";
  }
}

// ─────────────────────────────────────────
// デプロイ本体
// ─────────────────────────────────────────

interface DeployOptions {
  project?:      string;
  region:        string;
  service:       string;
  memory:        string;
  cpu:           string;
  minInstances:  string;
  maxInstances:  string;
  timeout:       string;
  concurrency:   string;
  allowUnauthenticated: boolean;
}

async function deploy(opts: DeployOptions): Promise<void> {
  // ── 前提チェック ──────────────────────────
  assertGcloud();

  const project = opts.project ?? getCurrentProject();
  if (!project) {
    log.error("GCP プロジェクト ID が設定されていません。");
    log.error("  gcloud config set project YOUR_PROJECT_ID");
    log.error("または --project オプションを指定してください。");
    process.exit(1);
  }

  const imageUri = `gcr.io/${project}/${opts.service}`;
  const TOTAL_STEPS = 3;

  console.log();
  console.log(`${c.bold}╔══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}║    doc-scanner  →  Cloud Run Deploy     ║${c.reset}`);
  console.log(`${c.bold}╚══════════════════════════════════════════╝${c.reset}`);
  console.log();
  log.info("プロジェクト :", project);
  log.info("サービス名   :", opts.service);
  log.info("リージョン   :", opts.region);
  log.info("イメージ URI :", imageUri);
  log.info("メモリ       :", opts.memory);
  log.info("CPU          :", opts.cpu);
  log.info("タイムアウト :", `${opts.timeout}s`);
  console.log();

  // ── Step 1: API 有効化 ────────────────────
  log.step(1, TOTAL_STEPS, "必要な GCP API を有効化");
  gcloud([
    "services", "enable",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "containerregistry.googleapis.com",
    "--project", project,
    "--quiet",
  ], "services enable");
  log.ok("API 有効化完了");

  // ── Step 2: Cloud Build でイメージをビルド & プッシュ ──
  log.step(2, TOTAL_STEPS, "Cloud Build でイメージをビルド & プッシュ");
  log.warn("初回は opencv4nodejs のコンパイルで 10〜15 分かかります...");

  // Dockerfile があるディレクトリ = プロジェクトルート
  const projectRoot = path.resolve(__dirname, "..", "..");

  gcloud([
    "builds", "submit",
    "--tag",          imageUri,
    "--project",      project,
    "--timeout",      "30m",
    "--machine-type", "E2_HIGHCPU_8",
    projectRoot,
  ], "builds submit");
  log.ok(`ビルド完了: ${imageUri}`);

  // ── Step 3: Cloud Run へデプロイ ──────────
  log.step(3, TOTAL_STEPS, "Cloud Run へデプロイ");

  const envVars = [
    "NODE_ENV=production",
    `PORT=8080`,
    "TESSDATA_DIR=/app/tessdata",
    "TEMP_DIR=/tmp/doc-scanner",
  ].join(",");

  const deployArgs = [
    "run", "deploy", opts.service,
    "--image",         imageUri,
    "--platform",      "managed",
    "--region",        opts.region,
    "--port",          "8080",
    "--memory",        opts.memory,
    "--cpu",           opts.cpu,
    "--min-instances", opts.minInstances,
    "--max-instances", opts.maxInstances,
    "--timeout",       `${opts.timeout}s`,
    "--concurrency",   opts.concurrency,
    "--set-env-vars",  envVars,
    "--project",       project,
    "--quiet",
  ];

  if (opts.allowUnauthenticated) {
    deployArgs.push("--allow-unauthenticated");
  }

  gcloud(deployArgs, "run deploy");
  log.ok("Cloud Run デプロイ完了");

  // ── 結果表示 ──────────────────────────────
  const serviceUrl = getServiceUrl(opts.service, opts.region, project);

  console.log();
  console.log(`${c.bold}╔══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}║           🚀 デプロイ完了！              ║${c.reset}`);
  console.log(`${c.bold}╚══════════════════════════════════════════╝${c.reset}`);
  console.log();
  log.ok("サービス URL:", serviceUrl);
  console.log();
  console.log("📡 エンドポイント:");
  console.log(`  GET  ${serviceUrl}/health`);
  console.log(`  POST ${serviceUrl}/ocr`);
  console.log(`  POST ${serviceUrl}/scan`);
  console.log(`  POST ${serviceUrl}/process`);
  console.log();
  console.log("📖 使用例:");
  console.log(`  curl -F "file=@photo.jpg" ${serviceUrl}/ocr`);
  console.log(`  curl -F "file=@photo.jpg" ${serviceUrl}/scan -o scanned.jpg`);
  console.log(`  curl -F "file=@photo.jpg" "${serviceUrl}/process?lang=jpn+eng" | jq`);
  console.log();
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────

const program = new Command();

program
  .name("deploy")
  .description("doc-scanner を Google Cloud Run にデプロイする")
  .option("--project <id>",         "GCP プロジェクト ID（省略時は gcloud のデフォルト）")
  .option("--region  <region>",     "デプロイリージョン",        "asia-northeast1")
  .option("--service <name>",       "Cloud Run サービス名",      "doc-scanner-api")
  .option("--memory  <size>",       "メモリ割り当て",            "2Gi")
  .option("--cpu     <n>",          "CPU 数",                    "2")
  .option("--min-instances <n>",    "最小インスタンス数",         "0")
  .option("--max-instances <n>",    "最大インスタンス数",         "10")
  .option("--timeout <sec>",        "リクエストタイムアウト(秒)", "300")
  .option("--concurrency <n>",      "同時リクエスト数",           "10")
  .option("--no-allow-unauthenticated", "認証を必須にする",       false)
  .addHelpText("after", `
使用例:
  $ npm run deploy
  $ npm run deploy -- --project my-gcp-project
  $ npm run deploy -- --project my-project --region us-central1 --memory 4Gi
  $ npm run deploy -- --service my-scanner --no-allow-unauthenticated
`);

program.parse(process.argv);

const opts = program.opts<{
  project?:                string;
  region:                  string;
  service:                 string;
  memory:                  string;
  cpu:                     string;
  minInstances:            string;
  maxInstances:            string;
  timeout:                 string;
  concurrency:             string;
  allowUnauthenticated:    boolean;
}>();

deploy({
  project:              opts.project,
  region:               opts.region,
  service:              opts.service,
  memory:               opts.memory,
  cpu:                  opts.cpu,
  minInstances:         opts.minInstances,
  maxInstances:         opts.maxInstances,
  timeout:              opts.timeout,
  concurrency:          opts.concurrency,
  allowUnauthenticated: opts.allowUnauthenticated,
}).catch((err) => {
  log.error(err.message ?? String(err));
  process.exit(1);
});
