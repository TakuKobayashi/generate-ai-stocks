import { EventEmitter } from 'events';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mic = require('mic');

import {
  BoundedBuffer,
  SAMPLE_RATE,
  VAD_FRAME_BYTES,
  MIN_RECORD_SECONDS,
  VOICE_START_FRAMES,
  SILENCE_END_FRAMES,
  pcmToSeconds,
} from './utils';
import { VadProcessor, VadStateMachine, VadResult, VadMode } from './vad';

export interface RecordingSession {
  pcmBuffer: Buffer;
  startedAt: Date;
  durationSeconds: number;
}

export type RecorderEvent =
  | { type: 'voice_start' }
  | { type: 'voice_end'; session: RecordingSession }
  | { type: 'too_short'; durationSeconds: number }
  | { type: 'error'; error: Error }
  | { type: 'level'; db: number };

/**
 * マイク入力を監視し、VAD で音声区間を検出して録音セッションを返す
 */
export class VoiceRecorder extends EventEmitter {
  private micInstance: unknown;
  private micStream: NodeJS.ReadableStream | null = null;
  private vadProcessor: VadProcessor;
  private vadStateMachine: VadStateMachine;
  private activeBuffer: BoundedBuffer | null = null;
  private sessionStart: Date | null = null;
  private isRunning = false;

  // VAD 前のバッファ（音声開始直前のデータも含めるため）
  private preRollBuffer: Buffer[] = [];
  private readonly PRE_ROLL_FRAMES = 10; // 100ms のプリロール

  constructor(private readonly vadMode: VadMode = VadMode.AGGRESSIVE) {
    super();
    this.vadProcessor = new VadProcessor(vadMode);
    this.vadStateMachine = new VadStateMachine(VOICE_START_FRAMES, SILENCE_END_FRAMES);
  }

  start(deviceId?: string): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const micConfig: Record<string, string | boolean> = {
      rate: String(SAMPLE_RATE),
      channels: '1',
      encoding: 'signed-integer',
      bitwidth: '16',
      endian: 'little',
      fileType: 'raw',
    };

    if (deviceId) {
      micConfig.device = deviceId;
    }

    try {
      this.micInstance = mic(micConfig);
      this.micStream = (this.micInstance as { getAudioStream: () => NodeJS.ReadableStream }).getAudioStream();
    } catch (err) {
      this.emit('event', {
        type: 'error',
        error: new Error(`マイク初期化エラー: ${String(err)}`),
      } satisfies RecorderEvent);
      return;
    }

    this.micStream!.on('data', (chunk: Buffer) => {
      this.handleChunk(chunk).catch((err: Error) => {
        this.emit('event', { type: 'error', error: err } satisfies RecorderEvent);
      });
    });

    this.micStream!.on('error', (err: Error) => {
      this.emit('event', { type: 'error', error: err } satisfies RecorderEvent);
    });

    (this.micInstance as { start: () => void }).start();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    // 録音中だった場合はセッションを終了
    if (this.activeBuffer && this.sessionStart) {
      this.finalizeSession();
    }

    try {
      (this.micInstance as { stop: () => void }).stop();
    } catch {
      // 無視
    }

    this.vadProcessor.destroy();
    this.vadStateMachine.reset();
    this.preRollBuffer = [];
    this.micStream = null;
  }

  private async handleChunk(chunk: Buffer): Promise<void> {
    // 音量レベルを計算（デバッグ用）
    const db = this.calculateDb(chunk);
    this.emit('event', { type: 'level', db } satisfies RecorderEvent);

    // プリロールバッファを更新（常に最新 N フレームを保持）
    this.preRollBuffer.push(chunk);
    while (this.preRollBuffer.length > this.PRE_ROLL_FRAMES) {
      this.preRollBuffer.shift();
    }

    // VAD 処理
    const events = await this.vadProcessor.processChunk(chunk);

    for (const event of events) {
      const state = this.vadStateMachine.update(event.result);

      if (state.started) {
        this.onVoiceStart();
      } else if (state.stopped) {
        this.onVoiceEnd();
        return; // セッション終了後は処理を止める
      }
    }

    // 録音中なら蓄積
    if (this.activeBuffer) {
      this.activeBuffer.push(chunk);
    }
  }

  private onVoiceStart(): void {
    this.sessionStart = new Date();
    this.activeBuffer = new BoundedBuffer();

    // プリロールを最初に追加（音声開始前の音声も含める）
    for (const preChunk of this.preRollBuffer) {
      this.activeBuffer.push(preChunk);
    }
    this.preRollBuffer = [];

    this.emit('event', { type: 'voice_start' } satisfies RecorderEvent);
  }

  private onVoiceEnd(): void {
    this.finalizeSession();
  }

  private finalizeSession(): void {
    if (!this.activeBuffer || !this.sessionStart) return;

    const pcmBuffer = this.activeBuffer.concat();
    const durationSeconds = pcmToSeconds(pcmBuffer.length);

    this.activeBuffer.clear();
    this.activeBuffer = null;
    const startedAt = this.sessionStart;
    this.sessionStart = null;

    if (durationSeconds < MIN_RECORD_SECONDS) {
      this.emit('event', { type: 'too_short', durationSeconds } satisfies RecorderEvent);
      return;
    }

    this.emit('event', {
      type: 'voice_end',
      session: { pcmBuffer, startedAt, durationSeconds },
    } satisfies RecorderEvent);
  }

  /**
   * PCM バッファのピーク dB を計算
   */
  private calculateDb(chunk: Buffer): number {
    let sumSquares = 0;
    const samples = chunk.length / 2;
    for (let i = 0; i < chunk.length; i += 2) {
      const sample = chunk.readInt16LE(i) / 32768;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / samples);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }
}
