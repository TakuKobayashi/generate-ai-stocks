package com.example.whispertranscriber.storage

import android.content.Context
import android.os.Environment
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * WAV / TXT ファイルの保存と管理
 * 保存先: /storage/emulated/0/Documents/WhisperTranscriber/
 */
class FileManager(private val context: Context) {

    companion object {
        private const val TAG = "FileManager"
        private const val OUTPUT_DIR = "WhisperTranscriber"
        private const val SAMPLE_RATE = 16000
        private const val CHANNELS = 1
        private const val BIT_DEPTH = 16
        private val TIMESTAMP_FORMAT = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
    }

    data class SavedFile(
        val wavFile: File,
        val txtFile: File,
        val timestamp: Long,
        val text: String,
        val durationSeconds: Float,
    )

    /**
     * 出力ディレクトリを取得（なければ作成）
     */
    fun getOutputDir(): File {
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
            OUTPUT_DIR
        )
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    /**
     * PCM データを WAV ファイルとして保存し、テキストも保存する
     *
     * @param pcmData  16kHz・16bit・モノラル PCM バイト列
     * @param text     文字起こしテキスト
     * @return         保存されたファイル情報（失敗時は null）
     */
    fun save(pcmData: ByteArray, text: String, durationSeconds: Float): SavedFile? {
        return try {
            val timestamp = System.currentTimeMillis()
            val baseName = TIMESTAMP_FORMAT.format(Date(timestamp))
            val dir = getOutputDir()

            val wavFile = File(dir, "$baseName.wav")
            val txtFile = File(dir, "$baseName.txt")

            writeWav(wavFile, pcmData)
            writeTxt(txtFile, text)

            Log.i(TAG, "保存完了: $baseName (.wav + .txt)")
            SavedFile(wavFile, txtFile, timestamp, text, durationSeconds)
        } catch (e: Exception) {
            Log.e(TAG, "ファイル保存エラー: ${e.message}")
            null
        }
    }

    /**
     * 保存済みファイル一覧を取得（新しい順）
     */
    fun listSavedFiles(): List<SavedFile> {
        val dir = getOutputDir()
        val txtFiles = dir.listFiles { f -> f.extension == "txt" } ?: return emptyList()

        return txtFiles
            .sortedByDescending { it.lastModified() }
            .mapNotNull { txtFile ->
                val wavFile = File(txtFile.parent, txtFile.nameWithoutExtension + ".wav")
                if (!wavFile.exists()) return@mapNotNull null

                try {
                    val text = txtFile.readText(Charsets.UTF_8)
                    val duration = if (wavFile.exists()) {
                        wavFile.length().let { size ->
                            (size - 44).toFloat() / (SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8))
                        }
                    } else 0f

                    SavedFile(wavFile, txtFile, txtFile.lastModified(), text, duration)
                } catch (e: Exception) {
                    Log.e(TAG, "ファイル読み込みエラー: ${e.message}")
                    null
                }
            }
    }

    /**
     * ファイルを削除する
     */
    fun delete(savedFile: SavedFile): Boolean {
        return try {
            savedFile.wavFile.delete()
            savedFile.txtFile.delete()
            true
        } catch (e: Exception) {
            Log.e(TAG, "ファイル削除エラー: ${e.message}")
            false
        }
    }

    // ===== WAV ファイル書き込み =====

    private fun writeWav(file: File, pcmData: ByteArray) {
        val dataSize = pcmData.size
        val byteRate = SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8)
        val blockAlign = CHANNELS * (BIT_DEPTH / 8)

        FileOutputStream(file).use { fos ->
            // WAV ヘッダー（44 バイト）
            fos.write(buildWavHeader(dataSize, byteRate, blockAlign))
            fos.write(pcmData)
        }
    }

    private fun buildWavHeader(dataSize: Int, byteRate: Int, blockAlign: Int): ByteArray {
        val header = ByteArray(44)
        var offset = 0

        fun writeString(s: String) { s.toByteArray().copyInto(header, offset); offset += s.length }
        fun writeInt32LE(v: Int) {
            header[offset] = (v and 0xFF).toByte()
            header[offset+1] = ((v shr 8) and 0xFF).toByte()
            header[offset+2] = ((v shr 16) and 0xFF).toByte()
            header[offset+3] = ((v shr 24) and 0xFF).toByte()
            offset += 4
        }
        fun writeInt16LE(v: Int) {
            header[offset] = (v and 0xFF).toByte()
            header[offset+1] = ((v shr 8) and 0xFF).toByte()
            offset += 2
        }

        writeString("RIFF")
        writeInt32LE(dataSize + 36)  // ファイルサイズ - 8
        writeString("WAVE")
        writeString("fmt ")
        writeInt32LE(16)             // fmt チャンクサイズ
        writeInt16LE(1)              // PCM = 1
        writeInt16LE(CHANNELS)
        writeInt32LE(SAMPLE_RATE)
        writeInt32LE(byteRate)
        writeInt16LE(blockAlign)
        writeInt16LE(BIT_DEPTH)
        writeString("data")
        writeInt32LE(dataSize)

        return header
    }

    private fun writeTxt(file: File, text: String) {
        file.writeText(text, Charsets.UTF_8)
    }
}
