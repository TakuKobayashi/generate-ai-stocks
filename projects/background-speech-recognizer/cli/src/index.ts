import * as path from 'path';

import { VoiceRecorder, RecorderEvent } from './recorder';
import { Transcriber } from './transcriber';
import { VadMode } from './vad';
import { SessionQueue } from './queue';
import { HealthMonitor } from './health';
import { logger } from './logger';
import { trySetRawMode, getDefaultWhisperBin, checkAudioDependency } from './platform';
import {
  getTimestamp,
  ensureOutputDir,
  writeWav,
  writeTxt,
  formatDuration,
} from './utils';

// ===================================================================
// 設定
// ===================================================================
const CONFIG = {
  whisperBin: process.env.WHISPER_BIN  ?? getDefaultWhisperBin(),
  modelPath:  process.env.WHISPER_MODEL ?? './models/ggml-base.bin',
  language:   process.env.WHISPER_LANG  ?? 'ja',
  outputDir:  process.env.OUTPUT_DIR    ?? './outputs',
  vadMode:    parseInt(process.env.VAD_MODE ?? '2') as VadMode,
  threads:    process.env.WHISPER_THREADS ? parseInt(process.env.WHISPER_THREADS) : undefined,
  queueSize:  parseInt(process.env.QUEUE_SIZE ?? '5'),
  deviceId:   process.env.MIC_DEVICE,
} as const;

// ===================================================================
// ANSI カラー（Windows Terminal / ConEmu 対応）
// ===================================================================
const USE_COLOR = process.env.NO_COLOR === undefined && process.stdout.isTTY;
const C = {
  reset:  USE_COLOR ? '\x1b[0m'  : '',
  bold:   USE_COLOR ? '\x1b[1m'  : '',
  dim:    USE_COLOR ? '\x1b[2m'  : '',
  red:    USE_COLOR ? '\x1b[31m' : '',
  green:  USE_COLOR ? '\x1b[32m' : '',
  yellow: USE_COLOR ? '\x1b[33m' : '',
  blue:   USE_COLOR ? '\x1b[34m' : '',
  cyan:   USE_COLOR ? '\x1b[36m' : '',
  white:  USE_COLOR ? '\x1b[37m' : '',
};

function logLine(msg: string): void {
  process.stdout.write(msg + '\n');
}

function printHeader(): void {
  if (process.stdout.isTTY) console.clear();
  logLine(`${C.bold}${C.cyan}╔════════════════════════════════════════╗${C.reset}`);
  logLine(`${C.bold}${C.cyan}║   🎙️  Whisper Local Transcriber CLI    ║${C.reset}`);
  logLine(`${C.bold}${C.cyan}╚════════════════════════════════════════╝${C.reset}`);
  logLine(`${C.dim}モデル  : ${CONFIG.modelPath}${C.reset}`);
  logLine(`${C.dim}言語    : ${CONFIG.language}${C.reset}`);
  logLine(`${C.dim}出力    : ${CONFIG.outputDir}${C.reset}`);
  logLine(`${C.dim}VAD     : モード ${CONFIG.vadMode}${C.reset}`);
  logLine('');
  logLine(`${C.yellow}▶ マイク待機中... 話しかけてください (Ctrl+C で終了)${C.reset}`);
  logLine(`${C.dim}${'─'.repeat(44)}${C.reset}`);
}

// ===================================================================
// メイン
// ===================================================================
async function main(): Promise<void> {
  // 未処理エラーをログに記録（プロセスをクラッシュさせない）
  process.on('unhandledRejection', (reason) => {
    logger.error(`[unhandledRejection] ${String(reason)}`);
    health.recordError();
  });
  process.on('uncaughtException', (err) => {
    logger.error(`[uncaughtException] ${err.message}\n${err.stack ?? ''}`);
    health.recordError();
    // 致命的エラーの場合はシャットダウン
    if (err.message.includes('ENOMEM') || err.message.includes('Out of memory')) {
      logger.error('メモリ不足による緊急終了');
      shutdown();
    }
  });

  // 音声依存ツールの確認
  const audioCheck = checkAudioDependency();
  if (!audioCheck.ok) {
    logger.error(audioCheck.message);
    process.exit(1);
  }

  ensureOutputDir(CONFIG.outputDir);
  printHeader();

  // ===== コンポーネント初期化 =====
  const health = new HealthMonitor();
  health.on('critical', () => {
    logger.error('[Main] メモリ緊急しきい値超過 — 再起動を推奨');
  });
  health.start();

  let transcriber: Transcriber;
  try {
    transcriber = new Transcriber({
      whisperBin: CONFIG.whisperBin,
      modelPath:  CONFIG.modelPath,
      language:   CONFIG.language,
      ...(CONFIG.threads ? { threads: CONFIG.threads } : {}),
    });
  } catch (err) {
    logger.error(`セットアップエラー: ${String(err)}`);
    logLine(`${C.red}❌ ${String(err)}${C.reset}`);
    process.exit(1);
  }

  const queue   = new SessionQueue(CONFIG.queueSize);
  const recorder = new VoiceRecorder(CONFIG.vadMode);

  // ===== シャットダウン =====
  let isShuttingDown = false;

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logLine(`\n\n${C.yellow}🛑 シャットダウン中...${C.reset}`);
    logger.info('[Main] シャットダウン開始');

    recorder.stop();
    health.stop();
    queue.clear();

    const s = health.getStatus();
    logLine(`\n${C.cyan}═══ 終了統計 ═══${C.reset}`);
    logLine(`  稼働時間      : ${formatDuration(s.uptimeSeconds)}`);
    logLine(`  文字起こし数  : ${s.transcriptions}`);
    logLine(`  エラー数      : ${s.errors}`);
    logLine(`  ドロップ数    : ${s.droppedSessions}`);
    logLine(`  マイク再接続  : ${s.micRestarts}`);
    logLine(`  ヒープ使用    : ${s.heapUsedMb} MB`);
    logLine(`${C.cyan}════════════════${C.reset}`);
    logLine(`${C.green}✅ 正常終了${C.reset}`);
    logger.info(`[Main] 正常終了 tx=${s.transcriptions} err=${s.errors}`);

    process.exit(0);
  }

  process.on('SIGINT',  () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  // Windows では SIGINT をキャプチャするには readline か keypress を使う
  // setRawMode は TTY のみ・失敗時は無視
  if (trySetRawMode(process.stdin)) {
    process.stdin.on('keypress', (_, key: { ctrl?: boolean; name?: string } | undefined) => {
      if (key?.ctrl && key.name === 'c') { void shutdown(); }
    });
  }

  // ===== 文字起こしワーカーループ =====
  // キューが溜まっても逐次処理（並列実行なし → CPU/メモリの暴走を防ぐ）
  let workerRunning = false;

  async function runWorker(): Promise<void> {
    if (workerRunning) return;
    workerRunning = true;

    while (!queue.isEmpty && !isShuttingDown) {
      const queued = queue.dequeue();
      if (!queued) break;

      const { session } = queued;
      const waitStr = formatDuration(queued.waitMs() / 1000);
      logLine(`\n${C.blue}⏹ 録音終了 (${formatDuration(session.durationSeconds)}, 待機 ${waitStr})${C.reset}`);
      process.stdout.write(`${C.dim}📝 文字起こし中...${C.reset}`);

      const timestamp = getTimestamp();
      const wavPath   = path.join(CONFIG.outputDir, `${timestamp}.wav`);
      const txtPath   = path.join(CONFIG.outputDir, `${timestamp}.txt`);

      try {
        writeWav(wavPath, session.pcmBuffer);

        const result = await transcriber.transcribeFile(wavPath);

        writeTxt(txtPath, result.text);
        health.recordTranscription();

        logLine(`\n${C.green}${C.bold}✅ 文字起こし完了 (${result.durationMs}ms)${C.reset}`);
        logLine(`${C.white}${C.bold}💬 ${result.text}${C.reset}`);
        logLine(`${C.dim}📁 ${wavPath}${C.reset}`);
        logLine(`${C.dim}📄 ${txtPath}${C.reset}`);
        logger.info(`[TX] "${result.text.slice(0, 80)}" (${result.durationMs}ms)`);

      } catch (err) {
        health.recordError();
        logLine(`\n${C.red}❌ 文字起こしエラー: ${String(err)}${C.reset}`);
        logger.error(`[TX] エラー: ${String(err)}`);

        // 文字起こし失敗時は WAV を削除
        try {
          const fs = await import('fs');
          if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        } catch { /* ignore */ }
      } finally {
        // pcmBuffer の参照を切ってメモリを返す
        (session as { pcmBuffer?: Buffer }).pcmBuffer = undefined as unknown as Buffer;
      }
    }

    workerRunning = false;

    if (!isShuttingDown) {
      const s = health.getStatus();
      logLine(
        `${C.yellow}▶ 待機中... ` +
        `(文字起こし: ${s.transcriptions} | エラー: ${s.errors} | ` +
        `ヒープ: ${s.heapUsedMb}MB)${C.reset}`
      );
    }
  }

  // ===== レコーダーイベントハンドラ =====
  recorder.on('event', (evt: RecorderEvent) => {
    if (isShuttingDown) return;

    switch (evt.type) {
      case 'voice_start':
        process.stdout.write(`\n${C.green}${C.bold}🔴 録音中...${C.reset} `);
        logger.debug('[Recorder] 音声検出開始');
        break;

      case 'too_short':
        logLine(`${C.dim}⏭ 短すぎてスキップ (${formatDuration(evt.durationSeconds)})${C.reset}`);
        break;

      case 'voice_end': {
        const { dropped } = queue.enqueue(evt.session);
        if (dropped) {
          health.recordDropped();
          logger.warn(`[Queue] セッションドロップ (キュー満杯) dur=${formatDuration(dropped.session.durationSeconds)}`);
          logLine(`${C.yellow}⚠ キュー満杯のため古いセッションをドロップしました${C.reset}`);
        }
        // ワーカーを起動（既に動いていれば何もしない）
        void runWorker();
        break;
      }

      case 'reconnecting':
        health.recordMicRestart();
        logLine(`\n${C.yellow}🔄 マイク再接続中 (試行 ${evt.attempt})...${C.reset}`);
        logger.warn(`[Recorder] マイク再接続 attempt=${evt.attempt}`);
        break;

      case 'level': {
        // 録音中のみ音量バーを表示
        const bar = Math.max(0, Math.min(20, Math.round((evt.db + 60) / 3)));
        process.stdout.write(
          `\r${C.green}${C.bold}🔴 録音中${C.reset} ` +
          `${C.green}${'█'.repeat(bar)}${C.dim}${'░'.repeat(20 - bar)}${C.reset} ` +
          `${evt.db.toFixed(1)}dB `
        );
        break;
      }

      case 'error':
        health.recordError();
        logLine(`\n${C.red}⚠ マイクエラー: ${evt.error.message}${C.reset}`);
        logger.error(`[Recorder] ${evt.error.message}`);
        break;
    }
  });

  // ===== 起動 =====
  logger.info(`[Main] 起動 bin=${CONFIG.whisperBin} model=${CONFIG.modelPath} lang=${CONFIG.language}`);
  recorder.start(CONFIG.deviceId);
}

main().catch((err: unknown) => {
  logger.error(`致命的エラー: ${String(err)}`);
  console.error('致命的エラー:', err);
  process.exit(1);
});
