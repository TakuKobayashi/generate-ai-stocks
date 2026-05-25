import * as fs from 'fs';
import * as path from 'path';

export const SAMPLE_RATE = 16000;
export const CHANNELS = 1;
export const BIT_DEPTH = 16;
export const BYTES_PER_SAMPLE = BIT_DEPTH / 8;

// 10ms フレーム = 160 サンプル = 320 バイト (WebRTC VAD 要件)
export const VAD_FRAME_MS = 10;
export const VAD_FRAME_SAMPLES = (SAMPLE_RATE * VAD_FRAME_MS) / 1000; // 160
export const VAD_FRAME_BYTES = VAD_FRAME_SAMPLES * BYTES_PER_SAMPLE;  // 320

// 録音設定
export const MIN_RECORD_SECONDS = 1.0;    // これ未満は保存しない
export const MAX_RECORD_SECONDS = 60.0;   // 最大録音時間
export const SILENCE_TIMEOUT_MS = 1500;   // 無音が続いたら録音終了
export const VOICE_START_FRAMES = 3;      // 音声開始判定フレーム数
export const SILENCE_END_FRAMES = 30;     // 無音終了判定フレーム数

export function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function ensureOutputDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * PCM バッファを WAV ファイルとして書き込む
 * WAV ヘッダーを手動で構築（外部依存なし）
 */
export function writeWav(filePath: string, pcmBuffer: Buffer): void {
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;

  const header = Buffer.alloc(headerSize);
  let offset = 0;

  // RIFF チャンク
  header.write('RIFF', offset);       offset += 4;
  header.writeUInt32LE(fileSize - 8, offset); offset += 4;
  header.write('WAVE', offset);       offset += 4;

  // fmt サブチャンク
  header.write('fmt ', offset);       offset += 4;
  header.writeUInt32LE(16, offset);   offset += 4;  // サブチャンクサイズ
  header.writeUInt16LE(1, offset);    offset += 2;  // PCM = 1
  header.writeUInt16LE(CHANNELS, offset); offset += 2;
  header.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
  header.writeUInt32LE(byteRate, offset);    offset += 4;
  header.writeUInt16LE(blockAlign, offset);  offset += 2;
  header.writeUInt16LE(BIT_DEPTH, offset);   offset += 2;

  // data サブチャンク
  header.write('data', offset); offset += 4;
  header.writeUInt32LE(dataSize, offset);

  fs.writeFileSync(filePath, Buffer.concat([header, pcmBuffer]));
}

export function writeTxt(filePath: string, text: string): void {
  fs.writeFileSync(filePath, text, 'utf-8');
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export function pcmToSeconds(byteLength: number): number {
  return byteLength / (SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE);
}

/**
 * メモリリーク防止のため、バッファリストを上限付きで管理
 */
export class BoundedBuffer {
  private chunks: Buffer[] = [];
  private totalBytes = 0;
  private readonly maxBytes: number;

  constructor(maxSeconds = MAX_RECORD_SECONDS) {
    this.maxBytes = maxSeconds * SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  }

  push(chunk: Buffer): void {
    if (this.totalBytes + chunk.length > this.maxBytes) {
      // 上限超過時は古いデータを削除
      while (this.chunks.length > 0 && this.totalBytes + chunk.length > this.maxBytes) {
        const removed = this.chunks.shift()!;
        this.totalBytes -= removed.length;
      }
    }
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;
  }

  concat(): Buffer {
    return Buffer.concat(this.chunks);
  }

  get byteLength(): number {
    return this.totalBytes;
  }

  clear(): void {
    this.chunks = [];
    this.totalBytes = 0;
  }
}
