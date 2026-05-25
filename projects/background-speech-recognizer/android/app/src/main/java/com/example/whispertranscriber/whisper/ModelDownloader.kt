package com.example.whispertranscriber.whisper

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * whisper.cpp ggml モデルのセットアップユーティリティ
 *
 * 優先順位:
 *   1. assets/ggml-base.bin（APK 同梱）
 *   2. filesDir/ggml-base.bin（前回コピー済み）
 *   3. 外部ストレージ /Documents/WhisperTranscriber/ggml-base.bin（ユーザー配置）
 */
object ModelDownloader {

    private const val TAG = "ModelDownloader"
    const val MODEL_FILENAME = "ggml-base.bin"

    // Hugging Face からダウンロードする場合の URL（オプション）
    private const val MODEL_URL =
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

    sealed class ModelResult {
        data class Found(val file: File) : ModelResult()
        data class Error(val message: String) : ModelResult()
    }

    /**
     * モデルファイルを取得する
     * assets → filesDir → 外部ストレージ の順で探す
     */
    suspend fun findOrCopyModel(context: Context): ModelResult = withContext(Dispatchers.IO) {
        // 1. filesDir にキャッシュされていれば使う
        val cachedFile = File(context.filesDir, MODEL_FILENAME)
        if (cachedFile.exists() && cachedFile.length() > 1_000_000L) {
            Log.i(TAG, "キャッシュ済みモデルを使用: ${cachedFile.absolutePath}")
            return@withContext ModelResult.Found(cachedFile)
        }

        // 2. assets から展開
        val fromAssets = copyFromAssets(context, cachedFile)
        if (fromAssets != null) {
            Log.i(TAG, "assets からモデルを展開: ${fromAssets.absolutePath}")
            return@withContext ModelResult.Found(fromAssets)
        }

        // 3. 外部ストレージを確認
        val externalFile = findInExternalStorage(context)
        if (externalFile != null) {
            Log.i(TAG, "外部ストレージにモデルを発見: ${externalFile.absolutePath}")
            // filesDir にコピーしてキャッシュ
            externalFile.copyTo(cachedFile, overwrite = true)
            return@withContext ModelResult.Found(cachedFile)
        }

        ModelResult.Error(
            "モデルファイルが見つかりません。\n" +
            "以下のいずれかの方法でモデルを配置してください:\n" +
            "  A) app/src/main/assets/$MODEL_FILENAME をビルド時に同梱\n" +
            "  B) /Documents/WhisperTranscriber/$MODEL_FILENAME に配置"
        )
    }

    /**
     * モデルサイズを人間が読める形式で返す
     */
    fun formatModelSize(file: File): String {
        val mb = file.length() / 1024.0 / 1024.0
        return "%.1f MB".format(mb)
    }

    // ===== プライベート =====

    private fun copyFromAssets(context: Context, dest: File): File? {
        return try {
            context.assets.open(MODEL_FILENAME).use { input ->
                FileOutputStream(dest).use { output ->
                    val buf = ByteArray(1024 * 1024) // 1MB バッファ
                    var read: Int
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                    }
                }
            }
            dest
        } catch (e: Exception) {
            Log.d(TAG, "assets にモデルなし: ${e.message}")
            null
        }
    }

    private fun findInExternalStorage(context: Context): File? {
        val dirs = listOf(
            android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOCUMENTS
            ).let { File(it, "WhisperTranscriber") },
            android.os.Environment.getExternalStorageDirectory(),
        )
        return dirs.firstNotNullOfOrNull { dir ->
            val f = File(dir, MODEL_FILENAME)
            if (f.exists() && f.length() > 1_000_000L) f else null
        }
    }
}
