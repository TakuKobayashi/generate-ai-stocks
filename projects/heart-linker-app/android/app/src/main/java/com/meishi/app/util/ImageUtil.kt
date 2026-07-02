package com.meishi.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID

object ImageUtil {
    private const val MAX_SIZE = 256

    /** Uriから読み込んだ画像を縮小してアプリ内部ストレージに保存し、パスを返す */
    fun saveIconFromUri(context: Context, uri: Uri): String? {
        val bitmap = loadBitmap(context, uri) ?: return null
        return saveBitmap(context, bitmap)
    }

    fun saveBitmap(context: Context, bitmap: Bitmap): String {
        val dir = File(context.filesDir, "profile_icons").apply { mkdirs() }
        val file = File(dir, "${UUID.randomUUID()}.jpg")
        file.outputStream().use { out ->
            scaleDown(bitmap).compress(Bitmap.CompressFormat.JPEG, 85, out)
        }
        return file.absolutePath
    }

    private fun loadBitmap(context: Context, uri: Uri): Bitmap? {
        return context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it)
        }
    }

    private fun scaleDown(bitmap: Bitmap): Bitmap {
        val ratio = minOf(MAX_SIZE.toFloat() / bitmap.width, MAX_SIZE.toFloat() / bitmap.height, 1f)
        if (ratio >= 1f) return bitmap
        val w = (bitmap.width * ratio).toInt()
        val h = (bitmap.height * ratio).toInt()
        return Bitmap.createScaledBitmap(bitmap, w, h, true)
    }

    /** 保存済みアイコンのファイルパス → JPEGバイト列(MessagePack送信用) */
    fun pathToBytes(path: String?): ByteArray? {
        if (path.isNullOrBlank()) return null
        val file = File(path)
        if (!file.exists()) return null
        val bitmap = BitmapFactory.decodeFile(path) ?: return null
        val stream = ByteArrayOutputStream()
        scaleDown(bitmap).compress(Bitmap.CompressFormat.JPEG, 70, stream)
        return stream.toByteArray()
    }

    /** 受信したJPEGバイト列 → アプリ内部ストレージに保存しパスを返す */
    fun bytesToPath(context: Context, bytes: ByteArray?): String? {
        if (bytes == null || bytes.isEmpty()) return null
        return try {
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
            saveBitmap(context, bitmap)
        } catch (e: Exception) {
            null
        }
    }
}
