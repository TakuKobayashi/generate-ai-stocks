package com.example.whispertranscriber.audio

import android.util.Log
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * VAD（Voice Activity Detector）
 *
 * WebRTC VAD アルゴリズムの簡略実装
 * 16kHz・16bit モノラル PCM に最適化
 *
 * 実装:
 *   1. エネルギーベース VAD（RMS + ゼロ交差率）
 *   2. 適応的閾値（ノイズフロア推定）
 *   3. ヒステリシスによるチャタリング防止
 */
class VadDetector(
    private val sampleRate: Int = 16000,
    private val sensitivity: Sensitivity = Sensitivity.AGGRESSIVE,
) {
    enum class Sensitivity {
        NORMAL,          // 静かな環境向け
        AGGRESSIVE,      // 一般的なオフィス向け
        VERY_AGGRESSIVE, // ノイズの多い環境向け
    }

    companion object {
        private const val TAG = "VadDetector"
        private const val FRAME_MS = 10        // 10ms フレーム
        private const val NOISE_FLOOR_ALPHA = 0.01f   // ノイズフロア更新速度
    }

    // 10ms フレームのサンプル数（16kHz → 160 サンプル）
    val frameSamples: Int = sampleRate * FRAME_MS / 1000
    val frameBytes: Int = frameSamples * 2  // 16bit = 2byte

    // 適応的ノイズフロア
    private var noiseFloorDb = -55.0f
    private var speechFloorDb = -35.0f

    // ステートマシン
    private var consecutiveVoiceFrames = 0
    private var consecutiveSilenceFrames = 0
    private var _isSpeechActive = false

    // 感度設定
    private val voiceStartFrames: Int
    private val silenceEndFrames: Int
    private val energyThresholdDb: Float

    init {
        when (sensitivity) {
            Sensitivity.NORMAL -> {
                voiceStartFrames = 5   // 50ms
                silenceEndFrames = 25  // 250ms
                energyThresholdDb = -40.0f
            }
            Sensitivity.AGGRESSIVE -> {
                voiceStartFrames = 3   // 30ms
                silenceEndFrames = 30  // 300ms
                energyThresholdDb = -45.0f
            }
            Sensitivity.VERY_AGGRESSIVE -> {
                voiceStartFrames = 2   // 20ms
                silenceEndFrames = 40  // 400ms
                energyThresholdDb = -50.0f
            }
        }
    }

    data class VadResult(
        val isSpeech: Boolean,
        val energyDb: Float,
        val started: Boolean,   // このフレームで音声が始まった
        val stopped: Boolean,   // このフレームで音声が終わった
    )

    /**
     * 1 フレーム（10ms = 320 バイト）の PCM を処理する
     *
     * @param frame  16bit LE PCM バイト列（320 バイト固定）
     */
    fun processFrame(frame: ByteArray): VadResult {
        require(frame.size == frameBytes) {
            "フレームサイズが不正: ${frame.size} (期待: $frameBytes)"
        }

        val energyDb = calculateRmsDb(frame)
        val zcr = calculateZeroCrossingRate(frame)

        // ノイズフロアを適応更新（無音時のみ）
        if (energyDb < noiseFloorDb + 10f && !_isSpeechActive) {
            noiseFloorDb = noiseFloorDb * (1 - NOISE_FLOOR_ALPHA) + energyDb * NOISE_FLOOR_ALPHA
        }

        // 動的閾値 = ノイズフロア + 余裕
        val dynamicThreshold = maxOf(noiseFloorDb + 12f, energyThresholdDb)

        // 音声判定（エネルギー + ゼロ交差率の複合判定）
        val energyVoice = energyDb > dynamicThreshold
        val zcrVoice = zcr in 0.05f..0.35f  // 人声の ZCR 範囲
        val isVoiceFrame = energyVoice && zcrVoice

        // ヒステリシス処理
        return updateState(isVoiceFrame, energyDb)
    }

    private fun updateState(isVoiceFrame: Boolean, energyDb: Float): VadResult {
        var started = false
        var stopped = false

        if (isVoiceFrame) {
            consecutiveVoiceFrames++
            consecutiveSilenceFrames = 0

            if (!_isSpeechActive && consecutiveVoiceFrames >= voiceStartFrames) {
                _isSpeechActive = true
                started = true
                Log.d(TAG, "音声検出開始 (${energyDb.toInt()}dB, floor=${noiseFloorDb.toInt()}dB)")
            }
        } else {
            consecutiveSilenceFrames++
            consecutiveVoiceFrames = 0

            if (_isSpeechActive && consecutiveSilenceFrames >= silenceEndFrames) {
                _isSpeechActive = false
                stopped = true
                Log.d(TAG, "音声検出終了 (無音${consecutiveSilenceFrames}フレーム継続)")
            }
        }

        return VadResult(
            isSpeech = _isSpeechActive,
            energyDb = energyDb,
            started = started,
            stopped = stopped,
        )
    }

    val isSpeechActive: Boolean get() = _isSpeechActive

    fun reset() {
        consecutiveVoiceFrames = 0
        consecutiveSilenceFrames = 0
        _isSpeechActive = false
        noiseFloorDb = -55.0f
    }

    // ===== 信号処理 =====

    /** RMS エネルギーを dBFS に変換 */
    private fun calculateRmsDb(frame: ByteArray): Float {
        var sumSquares = 0.0
        val numSamples = frame.size / 2
        for (i in 0 until numSamples) {
            val lo = frame[i * 2].toInt() and 0xFF
            val hi = frame[i * 2 + 1].toInt()
            val sample = ((hi shl 8) or lo).toShort().toFloat() / 32768.0f
            sumSquares += sample * sample
        }
        val rms = sqrt(sumSquares / numSamples).toFloat()
        return if (rms > 0f) 20f * log10(rms) else -100f
    }

    /** ゼロ交差率（ZCR）を計算 */
    private fun calculateZeroCrossingRate(frame: ByteArray): Float {
        var crossings = 0
        val numSamples = frame.size / 2
        var prevSign = 0

        for (i in 0 until numSamples) {
            val lo = frame[i * 2].toInt() and 0xFF
            val hi = frame[i * 2 + 1].toInt()
            val sample = ((hi shl 8) or lo).toShort()
            val sign = if (sample > 0) 1 else if (sample < 0) -1 else 0

            if (prevSign != 0 && sign != 0 && sign != prevSign) {
                crossings++
            }
            if (sign != 0) prevSign = sign
        }
        return crossings.toFloat() / numSamples
    }
}
