import * as path from 'path';
import * as readline from 'readline';

import { VoiceRecorder, RecorderEvent } from './recorder';
import { Transcriber } from './transcriber';
import { VadMode } from './vad';
import {
  getTimestamp,
  ensureOutputDir,
  writeWav,
  writeTxt,
  formatDuration,
} from './utils';

// ===== 設定 =====
const CONFIG = {
  // whisper.cpp バイナリのパス
  whisperBin: process.env.WHISPER_BIN ?? './whisper.cpp/build/bin/whisper-cli',

  // モデルファイルのパス
  modelPath: process.env.WHISPER_MODEL ?? './models/ggml-base.bin',

  // 言語設定 ('ja', 'en', 'auto' など)
  language: process.env.WHISPER_LANG ?? 'ja',

  // 出力ディレクトリ
  outputDir: process.env.OUTPUT_DIR ?? './outputs',

  // VAD モード (NORMAL=0, LOW_BITRATE=1, AGGRESSIVE=2, VERY_AGGRESSIVE=3)
  vadMode: parseInt(process.env.VAD_MODE ?? '2') as VadMode,

  // スレッド数 (未指定時は自動)
  threads: process.env.WHISPER_THREADS ? parseInt(process.env.WHISPER_THREADS) : undefined,
} as const;

// ===== ANSI カラー =====
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

function printHeader(): void {
  console.clear();
  log(`${C.bold}${C.cyan}╔════════════════════════════════════════╗${C.reset}`);
  log(`${C.bold}${C.cyan}║   🎙️  Whisper Local Transcriber CLI    ║${C.reset}`);
  log(`${C.bold}${C.cyan}╚════════════════════════════════════════╝${C.reset}`);
  log(`${C.dim}モデル  : ${CONFIG.modelPath}${C.reset}`);
  log(`${C.dim}言語    : ${CONFIG.language}${C.reset}`);
  log(`${C.dim}出力    : ${CONFIG.outputDir}${C.reset}`);
  log(`${C.dim}VAD     : モード ${CONFIG.vadMode}${C.reset}`);
  log('');
  log(`${C.yellow}▶ マイク待機中... 話しかけてください (Ctrl+C で終了)${C.reset}`);
  log(`${C.dim}${'─'.repeat(44)}${C.reset}`);
}

// ===== 統計カウンタ =====
let stats = {
  sessions: 0,
  saved: 0,
  errors: 0,
  tooShort: 0,
};

async function main(): Promise<void> {
  ensureOutputDir(CONFIG.outputDir);
  printHeader();

  let transcriber: Transcriber;
  try {
    transcriber = new Transcriber({
      whisperBin: CONFIG.whisperBin,
      modelPath: CONFIG.modelPath,
      language: CONFIG.language,
      ...(CONFIG.threads ? { threads: CONFIG.threads } : {}),
    });
  } catch (err) {
    log(`${C.red}❌ セットアップエラー: ${String(err)}${C.reset}`);
    process.exit(1);
  }

  const recorder = new VoiceRecorder(CONFIG.vadMode);

  // 文字起こし処理中フラグ（並列実行制限）
  let isTranscribing = false;
  // シャットダウンフラグ
  let isShuttingDown = false;

  recorder.on('event', async (evt: RecorderEvent) => {
    switch (evt.type) {

      case 'voice_start':
        stats.sessions++;
        process.stdout.write(`\n${C.green}${C.bold}🔴 録音中...${C.reset} `);
        break;

      case 'too_short':
        stats.tooShort++;
        log(`${C.dim}⏭ 短すぎるためスキップ (${formatDuration(evt.durationSeconds)})${C.reset}`);
        break;

      case 'voice_end': {
        const { session } = evt;
        log(`${C.blue}⏹ 録音終了 (${formatDuration(session.durationSeconds)})${C.reset}`);

        if (isTranscribing) {
          log(`${C.yellow}⚠ 文字起こし処理中のためスキップ${C.reset}`);
          return;
        }

        isTranscribing = true;
        process.stdout.write(`${C.dim}📝 文字起こし中...${C.reset}`);

        const timestamp = getTimestamp();
        const wavPath = path.join(CONFIG.outputDir, `${timestamp}.wav`);
        const txtPath = path.join(CONFIG.outputDir, `${timestamp}.txt`);

        try {
          // WAV を書き込んでサブプロセスに渡す
          writeWav(wavPath, session.pcmBuffer);

          const result = await transcriber.transcribeFile(wavPath);

          // 結果を TXT に保存
          writeTxt(txtPath, result.text);

          stats.saved++;
          log(`\n${C.green}${C.bold}✅ 文字起こし完了 (${result.durationMs}ms)${C.reset}`);
          log(`${C.white}${C.bold}💬 ${result.text}${C.reset}`);
          log(`${C.dim}📁 ${wavPath}${C.reset}`);
          log(`${C.dim}📄 ${txtPath}${C.reset}`);
          log(`${C.dim}${'─'.repeat(44)}${C.reset}`);

        } catch (err) {
          stats.errors++;
          log(`\n${C.red}❌ 文字起こしエラー: ${String(err)}${C.reset}`);

          // 文字起こし失敗時は WAV も削除
          try {
            const fs = await import('fs');
            fs.unlinkSync(wavPath);
          } catch {
            // 無視
          }
        } finally {
          isTranscribing = false;
        }

        if (!isShuttingDown) {
          log(`${C.yellow}▶ 待機中... (保存: ${stats.saved} | エラー: ${stats.errors} | 短すぎ: ${stats.tooShort})${C.reset}`);
        }
        break;
      }

      case 'level':
        // 音量インジケーター（録音中のみ表示）
        if (recorder.listenerCount('event') > 0) {
          const bar = Math.max(0, Math.min(20, Math.round((evt.db + 60) / 3)));
          process.stdout.write(`\r${C.green}${C.bold}🔴 録音中${C.reset} ${C.green}${'█'.repeat(bar)}${C.dim}${'░'.repeat(20 - bar)}${C.reset} ${evt.db.toFixed(1)}dB `);
        }
        break;

      case 'error':
        log(`${C.red}⚠ エラー: ${evt.error.message}${C.reset}`);
        stats.errors++;
        break;
    }
  });

  // Ctrl+C ハンドラ
  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log(`\n\n${C.yellow}🛑 シャットダウン中...${C.reset}`);
    recorder.stop();

    log(`\n${C.cyan}═══ 終了統計 ═══${C.reset}`);
    log(`  セッション数  : ${stats.sessions}`);
    log(`  保存済み      : ${stats.saved}`);
    log(`  短すぎスキップ: ${stats.tooShort}`);
    log(`  エラー        : ${stats.errors}`);
    log(`${C.cyan}════════════════${C.reset}`);
    log(`${C.green}✅ 正常終了${C.reset}`);

    // 処理中の文字起こしを待つ（最大5秒）
    if (isTranscribing) {
      log(`${C.dim}文字起こし処理の完了を待機中...${C.reset}`);
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!isTranscribing) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 5000);
      });
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // readline で SIGINT を横取りしないようにする
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (_, key) => {
      if (key?.ctrl && key.name === 'c') shutdown();
    });
  }

  recorder.start();
}

main().catch((err) => {
  console.error('致命的エラー:', err);
  process.exit(1);
});
