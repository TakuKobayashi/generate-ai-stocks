package com.example.whispertranscriber.whisper

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.max

/**
 * whisper.cpp JNI ラッパー
 * モデルの読み込み、推論、解放を管理する
 */
class WhisperEngine(private val context: Context) {

    companion object {
        private const val TAG = "WhisperEngine"
        private const val SAMPLE_RATE = 16000
        private const val MODEL_FILENAME = "ggml-base.bin"  // assets/ または外部ストレージ

        init {
            System.loadLibrary("whisper-jni")
        }
    }

    private var contextPtr: Long = 0L
    private var isInitialized = false

    // ===== JNI 宣言 =====
    private external fun nativeInitContext(modelPath: String): Long
    private external fun nativeFreeContext(contextPtr: Long)
    private external fun nativeTranscribe(
        contextPtr: Long,
        audioData: FloatArray,
        language: String,
        nThreads: Int
    ): String
    private external fun nativeSystemInfo(): String

    /**
     * モデルを初期化する
     * assets/ またはアプリの filesDir にモデルをコピーして使用
     *
     * @param modelFile  モデルファイル（存在しない場合は assets からコピー）
     * @return 初期化成功かどうか
     */
    suspend fun initialize(modelFile: File? = null): Boolean = withContext(Dispatchers.IO) {
        if (isInitialized) return@withContext true

        val file = modelFile ?: getDefaultModelFile()
        if (!file.exists()) {
            Log.e(TAG, "モデルファイルが見つかりません: ${file.absolutePath}")
            return@withContext false
        }

        Log.i(TAG, "モデル初期化: ${file.absolutePath} (${file.length() / 1024 / 1024}MB)")

        contextPtr = nativeInitContext(file.absolutePath)
        isInitialized = contextPtr != 0L

        if (isInitialized) {
            Log.i(TAG, "WhisperEngine 初期化完了\n${nativeSystemInfo()}")
        } else {
            Log.e(TAG, "WhisperEngine 初期化失敗")
        }

        isInitialized
    }

    /**
     * PCM 音声データ（16kHz・モノラル・Int16）を文字起こしする
     *
     * @param pcmBytes  Int16LE PCM バイト列
     * @param language  言語コード ("ja", "en", "auto")
     * @return          文字起こし結果テキスト（失敗時は null）
     */
    suspend fun transcribe(pcmBytes: ByteArray, language: String = "ja"): String? =
        withContext(Dispatchers.Default) {
            if (!isInitialized || contextPtr == 0L) {
                Log.e(TAG, "未初期化状態で transcribe が呼ばれました")
                return@withContext null
            }

            // Int16 PCM → Float32 に変換（-1.0f〜1.0f に正規化）
            val floatSamples = pcmToFloat(pcmBytes)

            // 最低 0.5 秒のサンプルがないと意味がない
            if (floatSamples.size < SAMPLE_RATE / 2) {
                Log.d(TAG, "サンプル数が少なすぎます: ${floatSamples.size}")
                return@withContext null
            }

            val nThreads = max(1, Runtime.getRuntime().availableProcessors() / 2)
            Log.d(TAG, "推論開始: ${floatSamples.size} サンプル, ${nThreads} スレッド")

            val start = System.currentTimeMillis()
            val result = nativeTranscribe(contextPtr, floatSamples, language, nThreads)
            val elapsed = System.currentTimeMillis() - start

            Log.d(TAG, "推論完了: ${elapsed}ms, テキスト長=${result.length}")

            result.trim().takeIf { it.isNotEmpty() }
        }

    /**
     * リソースを解放する（必ず onDestroy 時に呼ぶこと）
     */
    fun release() {
        if (contextPtr != 0L) {
            nativeFreeContext(contextPtr)
            contextPtr = 0L
        }
        isInitialized = false
        Log.i(TAG, "WhisperEngine 解放")
    }

    val isReady: Boolean get() = isInitialized && contextPtr != 0L

    // ===== プライベートヘルパー =====

    /**
     * assets/ からモデルを filesDir にコピーして返す
     */
    private fun getDefaultModelFile(): File {
        val destFile = File(context.filesDir, MODEL_FILENAME)
        if (!destFile.exists()) {
            try {
                context.assets.open(MODEL_FILENAME).use { input ->
                    destFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                Log.i(TAG, "assets からモデルをコピー: ${destFile.absolutePath}")
            } catch (e: Exception) {
                Log.e(TAG, "assets からのモデルコピー失敗: ${e.message}")
            }
        }
        return destFile
    }

    /**
     * Int16LE PCM バイト列を Float32 に変換
     */
    private fun pcmToFloat(pcmBytes: ByteArray): FloatArray {
        val numSamples = pcmBytes.size / 2
        val floatArray = FloatArray(numSamples)
        for (i in 0 until numSamples) {
            val lo = pcmBytes[i * 2].toInt() and 0xFF
            val hi = pcmBytes[i * 2 + 1].toInt()
            val sample = (hi shl 8) or lo
            floatArray[i] = sample.toShort().toFloat() / 32768.0f
        }
        return floatArray
    }
}
