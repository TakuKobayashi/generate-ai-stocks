package com.meishi.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Work
import androidx.compose.ui.graphics.vector.ImageVector
import com.meishi.app.model.SnsType

fun SnsType.icon(): ImageVector = when (this) {
    SnsType.TWITTER -> Icons.Filled.AlternateEmail
    SnsType.FACEBOOK -> Icons.Filled.Public
    SnsType.LINE -> Icons.Filled.Chat
    SnsType.WHATSAPP -> Icons.Filled.Chat
    SnsType.INSTAGRAM -> Icons.Filled.PlayArrow
    SnsType.TIKTOK -> Icons.Filled.MusicNote
    SnsType.YOUTUBE -> Icons.Filled.PlayArrow
    SnsType.GITHUB -> Icons.Filled.Code
    SnsType.LINKEDIN -> Icons.Filled.Work
    SnsType.WEBSITE -> Icons.Filled.Link
}
