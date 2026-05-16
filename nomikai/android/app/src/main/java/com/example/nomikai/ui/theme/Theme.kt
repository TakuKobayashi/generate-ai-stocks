package com.example.nomikai.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ビール/アンバーをテーマカラーに
val BeerAmber = Color(0xFFF59E0B)
val BeerAmberDark = Color(0xFFD97706)
val BeerAmberLight = Color(0xFFFDE68A)
val NightBlue = Color(0xFF1E293B)
val NightBlueDark = Color(0xFF0F172A)
val SurfaceLight = Color(0xFFFFFBF5)
val ErrorRed = Color(0xFFEF4444)

private val LightColorScheme = lightColorScheme(
    primary = BeerAmber,
    onPrimary = Color.White,
    primaryContainer = BeerAmberLight,
    onPrimaryContainer = NightBlueDark,
    secondary = NightBlue,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE2E8F0),
    onSecondaryContainer = NightBlueDark,
    background = SurfaceLight,
    surface = Color.White,
    onBackground = NightBlueDark,
    onSurface = NightBlueDark,
    error = ErrorRed,
    outline = Color(0xFFCBD5E1)
)

private val DarkColorScheme = darkColorScheme(
    primary = BeerAmber,
    onPrimary = NightBlueDark,
    primaryContainer = BeerAmberDark,
    onPrimaryContainer = Color.White,
    secondary = Color(0xFF94A3B8),
    onSecondary = NightBlueDark,
    background = NightBlueDark,
    surface = NightBlue,
    onBackground = Color.White,
    onSurface = Color.White,
    error = ErrorRed
)

@Composable
fun NomikaiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}
