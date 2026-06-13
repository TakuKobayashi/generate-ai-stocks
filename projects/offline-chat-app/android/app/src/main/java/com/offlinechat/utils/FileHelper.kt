package com.offlinechat.utils

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

object FileHelper {
    fun saveToInternalStorage(context: Context, uri: Uri, subDir: String = "chat_files"): String? {
        return runCatching {
            val dir = File(context.filesDir, subDir).apply { mkdirs() }
            val ext = MimeTypeMap.getSingleton()
                .getExtensionFromMimeType(context.contentResolver.getType(uri)) ?: "bin"
            val dest = File(dir, "${UUID.randomUUID()}.$ext")
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(dest).use { out -> input.copyTo(out) }
            }
            dest.absolutePath
        }.getOrNull()
    }

    fun formatSize(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${"%.1f".format(bytes / 1024.0)} KB"
        else -> "${"%.1f".format(bytes / (1024.0 * 1024))} MB"
    }
}
