package com.example.ais.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── Palette ───────────────────────────────────────────────

object AISColors {
    val Background = Color(0xFF080808)
    val Surface = Color(0xFF111111)
    val Divider = Color(0xFF1E1E1E)
    val InputBorder = Color(0xFF2A2A2A)
    val InputBorderActive = Color(0xFF444444)
    val TextPrimary = Color.White
    val TextSecondary = Color(0xFF888888)
    val TextHint = Color(0xFF333333)
    val TextDisabled = Color(0xFF2A2A2A)
    val AccentSoft = Color(0xFF3A3A3A)
    val ChipSelected = Color.White
    val ChipUnselected = Color(0xFF1A1A1A)
    val ChipBorderSelected = Color(0xFF666666)
    val ChipBorderUnselected = Color(0xFF222222)
    val Error = Color(0xFFFF5252)
    val Success = Color(0xFF69F0AE)
}

private val DarkColorScheme = darkColorScheme(
    primary = Color.White,
    onPrimary = Color.Black,
    background = AISColors.Background,
    surface = AISColors.Surface,
    onBackground = AISColors.TextPrimary,
    onSurface = AISColors.TextPrimary,
)

@Composable
fun AISTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
