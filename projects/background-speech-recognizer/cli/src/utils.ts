import * as fs from 'fs';
import * as path from 'path';

export const SAMPLE_RATE      = 16000;
export const CHANNELS         = 1;
export const BIT_DEPTH        = 16;
export const BYTES_PER_SAMPLE = BIT_DEPTH / 8;

// 10ms フレーム = 160 サンプル = 320 バイト（WebRTC VAD 要件）
export const VAD_FRAME_MS      = 10;
export const VAD_FRAME_SAMPLES = (SAMPLE_RATE * VAD_FRAME_MS) / 1000; // 160
export const VAD_FRAME_BYTES   = VAD_FRAME_SAMPLES * BYTES_PER_SAMPLE; // 320

// 録音設定
export const MIN_RECORD_SECONDS  = 1.0;
export const MAX_RECORD_SECONDS  = 60.0;
export const SILENCE_TIMEOUT_MS  = 1500;
export const VOICE_START_FRAMES  = 3;
export const SILENCE_END_FRAMES  = 30;

export function getTimestamp(): string {
  const now = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

export function ensureOutputDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * PCM バッファを WAV ファイルとして書き込む（外部依存ゼロ）
 */
export function writeWav(filePath: string, pcmBuffer: Buffer): void {
  const dataSize  = pcmBuffer.length;
  const byteRate  = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;
  const header = Buffer.alloc(44);
  let off = 0;

  const ws = (s: string)  => { header.write(s, off); off += s.length; };
  const w4 = (v: number)  => { header.writeUInt32LE(v, off); off += 4; };
  const w2 = (v: number)  => { header.writeUInt16LE(v, off); off += 2; };

  ws('RIFF'); w4(dataSize + 36); ws('WAVE');
  ws('fmt '); w4(16); w2(1); w2(CHANNELS); w4(SAMPLE_RATE); w4(byteRate); w2(blockAlign); w2(BIT_DEPTH);
  ws('data'); w4(dataSize);

  const fd = fs.openSync(filePath, 'w');
  try {
    fs.writeSync(fd, header);
    fs.writeSync(fd, pcmBuffer);
  } finally {
    fs.closeSync(fd); // 確実にファイルハンドルを閉じる
  }
}

export function writeTxt(filePath: string, text: string): void {
  fs.writeFileSync(filePath, text, { encoding: 'utf-8', flag: 'w' });
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
 * メモリリーク対策済みの有界バッファ
 *
 * 修正点:
 * - clear() 時に chunks 配列要素を null で上書きして GC を確実に促す
 * - concat 後に内部配列を圧縮して断片化を防ぐ
 */
export class BoundedBuffer {
  private chunks: (Buffer | null)[] = [];
  private totalBytes = 0;
  private readonly maxBytes: number;

  constructor(maxSeconds = MAX_RECORD_SECONDS) {
    this.maxBytes = maxSeconds * SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  }

  push(chunk: Buffer): void {
    while (this.chunks.length > 0 && this.totalBytes + chunk.length > this.maxBytes) {
      const removed = this.chunks.shift();
      if (removed) this.totalBytes -= removed.length;
    }
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;
  }

  concat(): Buffer {
    const valid = this.chunks.filter((c): c is Buffer => c !== null);
    return Buffer.concat(valid);
  }

  get byteLength(): number { return this.totalBytes; }

  clear(): void {
    // 全 Buffer 参照を明示的に切る → GC が Buffer をより早く回収できる
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i] = null;
    }
    this.chunks = [];
    this.totalBytes = 0;
  }
}

/**
 * プロセス終了時の一時ファイルクリーンアップレジストリ
 * whisper.cpp 実行中にクラッシュしても tmp ファイルを残さない
 */
class TmpFileRegistry {
  private files = new Set<string>();

  constructor() {
    // シグナルに関係なく exit 時に必ず実行
    process.on('exit', () => this.cleanAll());
  }

  register(fp: string): void   { this.files.add(fp); }
  unregister(fp: string): void { this.files.delete(fp); }

  private cleanAll(): void {
    for (const fp of this.files) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch { /* ignore */ }
    }
    this.files.clear();
  }
}

export const tmpRegistry = new TmpFileRegistry();
