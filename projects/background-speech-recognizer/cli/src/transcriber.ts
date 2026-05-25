import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface TranscribeOptions {
  whisperBin: string;      // whisper.cpp バイナリパス (例: './whisper.cpp/build/bin/whisper-cli')
  modelPath: string;       // モデルファイルパス (例: './models/ggml-base.bin')
  language?: string;       // 言語コード (例: 'ja', 'en', 'auto')
  threads?: number;        // スレッド数
  timeoutMs?: number;      // タイムアウト (ms)
}

export interface TranscribeResult {
  text: string;
  durationMs: number;
  wavPath: string;
}

/**
 * whisper.cpp をサブプロセスとして実行し、WAV ファイルを文字起こしする
 */
export class Transcriber {
  private readonly options: Required<TranscribeOptions>;

  constructor(options: TranscribeOptions) {
    this.options = {
      language: 'ja',
      threads: Math.max(1, Math.floor(os.cpus().length / 2)),
      timeoutMs: 30_000,
      ...options,
    };

    this.validateSetup();
  }

  private validateSetup(): void {
    if (!fs.existsSync(this.options.whisperBin)) {
      throw new Error(
        `whisper.cpp バイナリが見つかりません: ${this.options.whisperBin}\n` +
        'README の "whisper.cpp セットアップ" を参照してください。'
      );
    }
    if (!fs.existsSync(this.options.modelPath)) {
      throw new Error(
        `モデルファイルが見つかりません: ${this.options.modelPath}\n` +
        'README の "モデルダウンロード" を参照してください。'
      );
    }
  }

  /**
   * WAV バッファをサブプロセスに渡して文字起こし
   * 一時ファイルを利用（メモリ上の処理後に削除）
   */
  async transcribe(wavBuffer: Buffer): Promise<TranscribeResult> {
    const tmpFile = path.join(os.tmpdir(), `whisper_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);

    try {
      fs.writeFileSync(tmpFile, wavBuffer);
      return await this.transcribeFile(tmpFile);
    } finally {
      // 一時ファイルを確実に削除
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // 削除失敗は無視
      }
    }
  }

  /**
   * WAV ファイルを直接文字起こし
   */
  async transcribeFile(wavPath: string): Promise<TranscribeResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.options.modelPath,
        '-f', wavPath,
        '-l', this.options.language,
        '-t', String(this.options.threads),
        '--no-timestamps',          // タイムスタンプ出力を抑制
        '-nt',                      // 翻訳なし
        '--output-txt',             // TXT 出力
        '-of', wavPath.replace(/\.wav$/, ''), // 出力ファイルプレフィックス
      ];

      const proc = spawn(this.options.whisperBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`whisper.cpp タイムアウト (${this.options.timeoutMs}ms)`));
      }, this.options.timeoutMs);

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`whisper.cpp 起動エラー: ${err.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`whisper.cpp が非ゼロで終了: code=${code}\nstderr: ${stderr.slice(0, 500)}`));
          return;
        }

        // whisper.cpp の stdout から直接テキストを抽出
        const text = this.extractText(stdout);
        if (!text.trim()) {
          reject(new Error('文字起こし結果が空でした'));
          return;
        }

        resolve({
          text: text.trim(),
          durationMs: Date.now() - startTime,
          wavPath,
        });
      });
    });
  }

  /**
   * whisper.cpp stdout からテキスト部分を抽出
   * 出力例: "[00:00:00.000 --> 00:00:02.000]  こんにちは"
   */
  private extractText(output: string): string {
    const lines = output.split('\n');
    const textLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // タイムスタンプ行をスキップ
      if (trimmed.startsWith('[') && trimmed.includes('-->')) {
        const match = trimmed.match(/\]\s+(.+)$/);
        if (match) textLines.push(match[1].trim());
        continue;
      }

      // プレーンテキスト行（デバッグ出力除外）
      if (
        trimmed &&
        !trimmed.startsWith('whisper_') &&
        !trimmed.startsWith('system_info') &&
        !trimmed.startsWith('main:') &&
        !trimmed.startsWith('log_mel') &&
        !trimmed.match(/^\d+\.\d+%/) // 進捗表示
      ) {
        textLines.push(trimmed);
      }
    }

    return textLines.join(' ');
  }
}
