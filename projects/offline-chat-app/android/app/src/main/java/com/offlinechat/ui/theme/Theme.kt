package com.offlinechat.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

@Composable
fun OfflineChatTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val colorScheme = dynamicLightColorScheme(context)
    MaterialTheme(colorScheme = colorScheme, content = content)
}
