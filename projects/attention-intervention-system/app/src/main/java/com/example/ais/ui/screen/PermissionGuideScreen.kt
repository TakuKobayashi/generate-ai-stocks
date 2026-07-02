package com.example.ais.ui.screen

import android.Manifest
import android.app.AlarmManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ais.domain.InterventionMode
import com.example.ais.ui.theme.AISColors

/**
 * 権限取得ガイド画面。
 *
 * 表示する権限:
 * 1. 通知 (POST_NOTIFICATIONS) - Android 13+ 必須
 * 2. 正確なアラーム (SCHEDULE_EXACT_ALARM) - Android 12+ 設定画面誘導
 * 3. 他のアプリの上に表示 (SYSTEM_ALERT_WINDOW) - Hard モード時のみ表示
 *
 * [mode] が HARD の場合のみ Overlay 権限行を表示する。
 */
@Composable
fun PermissionGuideScreen(
    selectedMode: InterventionMode,
    onComplete: () -> Unit
) {
    val context = LocalContext.current

    // ── 権限状態 ──────────────────────────────────────────

    var notifGranted by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) false else true
        )
    }
    var alarmGranted by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                context.getSystemService(AlarmManager::class.java)
                    ?.canScheduleExactAlarms() ?: true
            else true
        )
    }
    var overlayGranted by remember {
        mutableStateOf(Settings.canDrawOverlays(context))
    }

    // ── Launchers ─────────────────────────────────────────

    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> notifGranted = granted }

    val alarmSettingsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        alarmGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            context.getSystemService(AlarmManager::class.java)
                ?.canScheduleExactAlarms() ?: true
        else true
    }

    val overlaySettingsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        overlayGranted = Settings.canDrawOverlays(context)
    }

    // ── UI ────────────────────────────────────────────────

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AISColors.Background)
            .padding(horizontal = 32.dp)
    ) {
        Spacer(modifier = Modifier.height(72.dp))

        Text("AIS", color = AISColors.TextSecondary, fontSize = 11.sp, letterSpacing = 6.sp)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "目標が\nあなたに届くために",
            color = AISColors.TextPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.Light,
            lineHeight = 42.sp
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "以下の権限を許可することで\n最適な介入体験が得られます",
            color = AISColors.TextSecondary,
            fontSize = 13.sp,
            lineHeight = 20.sp
        )
        Spacer(modifier = Modifier.height(40.dp))

        // 通知権限（必須）
        PermissionRow(
            title = "通知",
            description = "ロック画面や通知欄に目標を表示します",
            badge = "必須",
            badgeColor = Color(0xFFFF5252),
            granted = notifGranted,
            onRequest = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    notifGranted = true
                }
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 正確なアラーム（推奨）
        PermissionRow(
            title = "正確なアラーム",
            description = "毎朝6時に確実に通知を更新します",
            badge = "推奨",
            badgeColor = Color(0xFFFFAB40),
            granted = alarmGranted,
            onRequest = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    alarmSettingsLauncher.launch(
                        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                            data = Uri.parse("package:${context.packageName}")
                        }
                    )
                } else {
                    alarmGranted = true
                }
            }
        )

        // Hard モードのみ Overlay 権限を表示
        if (selectedMode == InterventionMode.HARD) {
            Spacer(modifier = Modifier.height(12.dp))
            PermissionRow(
                title = "他のアプリの上に表示",
                description = "画面ON時に目標カードを0.9秒表示します（Hard モード専用）",
                badge = "Hard",
                badgeColor = Color(0xFF69F0AE),
                granted = overlayGranted,
                onRequest = {
                    overlaySettingsLauncher.launch(
                        Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:${context.packageName}")
                        )
                    )
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Play Store審査リスクの説明
            OverlayExplainer()
        }

        Spacer(modifier = Modifier.weight(1f))

        StartButton(
            enabled = notifGranted,
            onClick = onComplete
        )

        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
private fun PermissionRow(
    title: String,
    description: String,
    badge: String,
    badgeColor: Color,
    granted: Boolean,
    onRequest: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(AISColors.Surface)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Canvas(modifier = Modifier.size(8.dp)) {
            drawCircle(color = if (granted) Color(0xFF69F0AE) else Color(0xFF333333))
        }

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    color = AISColors.TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = badge,
                    color = badgeColor,
                    fontSize = 10.sp,
                    modifier = Modifier
                        .border(
                            width = 1.dp,
                            color = badgeColor.copy(alpha = 0.4f),
                            shape = RoundedCornerShape(3.dp)
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = description,
                color = AISColors.TextSecondary,
                fontSize = 12.sp,
                lineHeight = 17.sp
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        if (!granted) {
            Text(
                text = "許可",
                color = Color.White,
                fontSize = 13.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(AISColors.AccentSoft)
                    .clickable { onRequest() }
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            )
        } else {
            Text(text = "✓", color = Color(0xFF69F0AE), fontSize = 16.sp)
        }
    }
}

@Composable
private fun OverlayExplainer() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF0D1A0D))
            .border(
                width = 1.dp,
                color = Color(0xFF1A3A1A),
                shape = RoundedCornerShape(8.dp)
            )
            .padding(14.dp)
    ) {
        Text(
            text = "この権限について",
            color = Color(0xFF69F0AE),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "「他のアプリの上に表示」権限は、画面ON時に目標テキストを0.9秒間カード表示するために使用します。" +
                    "個人情報の収集・広告表示には使用しません。" +
                    "不要な場合は Normal モードをお使いください。",
            color = AISColors.TextSecondary,
            fontSize = 12.sp,
            lineHeight = 18.sp
        )
    }
}

@Composable
private fun StartButton(enabled: Boolean, onClick: () -> Unit) {
    Text(
        text = if (enabled) "始める →" else "通知を許可してください",
        color = if (enabled) Color.Black else AISColors.TextSecondary,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(if (enabled) AISColors.TextPrimary else AISColors.Surface)
            .then(if (enabled) Modifier.clickable { onClick() } else Modifier)
            .padding(vertical = 16.dp)
    )
}
