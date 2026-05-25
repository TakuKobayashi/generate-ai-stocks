import { EventEmitter } from 'events';
import { VAD_FRAME_BYTES, VAD_FRAME_SAMPLES, SAMPLE_RATE } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeVad = require('node-vad');

export enum VadMode {
  NORMAL = 0,
  LOW_BITRATE = 1,
  AGGRESSIVE = 2,
  VERY_AGGRESSIVE = 3,
}

export enum VadResult {
  SILENCE = 'SILENCE',
  VOICE = 'VOICE',
  ERROR = 'ERROR',
}

export type VadEvent = {
  result: VadResult;
  frameIndex: number;
};

/**
 * WebRTC VAD ラッパー
 * node-vad は 10/20/30ms フレーム・16kHz モノラル 16bit PCM を要求
 */
export class VadProcessor extends EventEmitter {
  private vad: unknown;
  private frameIndex = 0;
  private residualBuffer = Buffer.alloc(0);

  constructor(mode: VadMode = VadMode.AGGRESSIVE) {
    super();
    this.vad = new NodeVad(mode);
  }

  /**
   * 任意サイズの PCM チャンクを受け取り、10ms フレーム単位で処理する
   * 余りは次回に持ち越し
   */
  async processChunk(chunk: Buffer): Promise<VadEvent[]> {
    // 前回の残りと結合
    const buf = Buffer.concat([this.residualBuffer, chunk]);
    const events: VadEvent[] = [];

    let offset = 0;
    while (offset + VAD_FRAME_BYTES <= buf.length) {
      const frame = buf.slice(offset, offset + VAD_FRAME_BYTES);
      offset += VAD_FRAME_BYTES;

      try {
        const result = await (this.vad as { processAudio: (f: Buffer, sr: number) => Promise<number> })
          .processAudio(frame, SAMPLE_RATE);

        const vadResult = this.mapResult(result);
        const event: VadEvent = { result: vadResult, frameIndex: this.frameIndex++ };
        events.push(event);
        this.emit('frame', event);
      } catch (err) {
        events.push({ result: VadResult.ERROR, frameIndex: this.frameIndex++ });
      }
    }

    // 余りを保持（最大1フレーム未満）
    this.residualBuffer = buf.slice(offset);

    return events;
  }

  private mapResult(raw: number): VadResult {
    // node-vad: 0 = SILENCE, 1 = NO_VOICE, 2 = VOICE
    if (raw === 2) return VadResult.VOICE;
    return VadResult.SILENCE;
  }

  reset(): void {
    this.residualBuffer = Buffer.alloc(0);
    this.frameIndex = 0;
  }

  destroy(): void {
    this.removeAllListeners();
    this.residualBuffer = Buffer.alloc(0);
  }
}

/**
 * VAD イベントのデバウンス処理
 * 短い音声スパイクやノイズを除去するためのステートマシン
 */
export class VadStateMachine {
  private consecutiveVoice = 0;
  private consecutiveSilence = 0;
  private _isVoiceActive = false;

  constructor(
    private readonly voiceStartFrames: number,   // 音声開始に必要な連続フレーム
    private readonly silenceEndFrames: number,    // 音声終了に必要な連続無音フレーム
  ) {}

  update(result: VadResult): { started: boolean; stopped: boolean; active: boolean } {
    if (result === VadResult.VOICE) {
      this.consecutiveVoice++;
      this.consecutiveSilence = 0;
    } else {
      this.consecutiveSilence++;
      this.consecutiveVoice = 0;
    }

    let started = false;
    let stopped = false;

    if (!this._isVoiceActive && this.consecutiveVoice >= this.voiceStartFrames) {
      this._isVoiceActive = true;
      started = true;
    } else if (this._isVoiceActive && this.consecutiveSilence >= this.silenceEndFrames) {
      this._isVoiceActive = false;
      stopped = true;
      this.consecutiveVoice = 0;
    }

    return { started, stopped, active: this._isVoiceActive };
  }

  get isVoiceActive(): boolean {
    return this._isVoiceActive;
  }

  reset(): void {
    this.consecutiveVoice = 0;
    this.consecutiveSilence = 0;
    this._isVoiceActive = false;
  }
}
