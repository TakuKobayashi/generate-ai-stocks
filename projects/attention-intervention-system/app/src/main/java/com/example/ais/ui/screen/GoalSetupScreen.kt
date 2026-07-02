package com.example.ais.ui.screen

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ais.domain.InterventionMode
import com.example.ais.ui.theme.AISColors
import com.example.ais.ui.viewmodel.GoalViewModel

@Composable
fun GoalSetupScreen(
    viewModel: GoalViewModel = hiltViewModel(),
    onSaved: () -> Unit = {}
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // Overlay権限状態（Hard選択時に再チェック）
    var overlayGranted by remember {
        mutableStateOf(Settings.canDrawOverlays(context))
    }

    LaunchedEffect(state.saveSuccess) {
        if (state.saveSuccess) {
            viewModel.consumeSaveSuccess()
            onSaved()
        }
    }

    // Hard モード切替時にOverlay権限を再確認
    LaunchedEffect(state.mode) {
        if (state.mode == InterventionMode.HARD) {
            overlayGranted = Settings.canDrawOverlays(context)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AISColors.Background)
            .padding(horizontal = 28.dp)
    ) {
        Spacer(modifier = Modifier.height(64.dp))

        // ── ヘッダー ───────────────────────────────────────
        Text("AIS", color = AISColors.TextSecondary, fontSize = 11.sp, letterSpacing = 6.sp)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "今日の目標",
            color = AISColors.TextPrimary,
            fontSize = 24.sp,
            fontWeight = FontWeight.Light,
            letterSpacing = 2.sp
        )
        Spacer(modifier = Modifier.height(6.dp))

        if (!state.canEdit) {
            Text(
                text = "編集は明日 0:00 以降",
                color = AISColors.TextSecondary,
                fontSize = 12.sp
            )
        }

        Spacer(modifier = Modifier.height(40.dp))

        // ── 目標入力 × 3 ──────────────────────────────────
        state.draftTexts.forEachIndexed { index, text ->
            GoalInputField(
                value = text,
                index = index + 1,
                enabled = state.canEdit,
                onValueChange = { viewModel.updateDraft(index, it) },
                imeAction = if (index < 2) ImeAction.Next else ImeAction.Done
            )
            Spacer(modifier = Modifier.height(24.dp))
        }

        // ── エラー ─────────────────────────────────────────
        AnimatedVisibility(visible = state.errorMessage != null, enter = fadeIn(), exit = fadeOut()) {
            state.errorMessage?.let {
                Text(
                    text = it,
                    color = AISColors.Error,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // ── 保存ボタン ─────────────────────────────────────
        if (state.canEdit) {
            SaveButton(isSaving = state.isSaving, onClick = { viewModel.saveGoals() })
        }

        Spacer(modifier = Modifier.height(40.dp))

        // ── モード選択 ─────────────────────────────────────
        ModeSelector(selected = state.mode, onSelect = { viewModel.setMode(it) })

        Spacer(modifier = Modifier.height(8.dp))
        Text(text = state.mode.description, color = AISColors.TextSecondary, fontSize = 12.sp)

        // ── Overlay権限バナー (Hard + 未許可 時のみ) ───────
        if (state.mode == InterventionMode.HARD && !overlayGranted) {
            Spacer(modifier = Modifier.height(16.dp))
            OverlayPermissionBanner(
                onOpenSettings = {
                    context.startActivity(
                        Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:${context.packageName}")
                        )
                    )
                }
            )
        }

        Spacer(modifier = Modifier.height(40.dp))
    }
}

// ── 目標入力フィールド ─────────────────────────────────────

@Composable
private fun GoalInputField(
    value: String,
    index: Int,
    enabled: Boolean,
    onValueChange: (String) -> Unit,
    imeAction: ImeAction = ImeAction.Next
) {
    val borderColor = if (enabled && value.isNotEmpty()) AISColors.InputBorderActive
    else AISColors.InputBorder

    Column {
        Row(
            verticalAlignment = Alignment.Bottom,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = index.toString(),
                color = AISColors.TextHint,
                fontSize = 11.sp,
                modifier = Modifier
                    .width(20.dp)
                    .padding(bottom = 10.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            BasicTextField(
                value = value,
                onValueChange = { if (it.length <= 40) onValueChange(it) },
                enabled = enabled,
                singleLine = true,
                textStyle = TextStyle(
                    color = if (enabled) AISColors.TextPrimary else AISColors.TextDisabled,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Light,
                    letterSpacing = 0.5.sp
                ),
                cursorBrush = SolidColor(AISColors.TextPrimary),
                keyboardOptions = KeyboardOptions(imeAction = imeAction),
                modifier = Modifier
                    .fillMaxWidth()
                    .drawBehind {
                        drawLine(
                            color = borderColor,
                            start = Offset(0f, size.height),
                            end = Offset(size.width, size.height),
                            strokeWidth = 1.dp.toPx()
                        )
                    }
                    .padding(bottom = 10.dp),
                decorationBox = { inner ->
                    Box {
                        if (value.isEmpty()) {
                            Text(
                                text = "目標を1行で入力",
                                color = AISColors.TextHint,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Light
                            )
                        }
                        inner()
                    }
                }
            )
        }
        if (value.isNotEmpty() && enabled) {
            Text(
                text = "${value.length}/40",
                color = if (value.length > 35) AISColors.Error else AISColors.TextSecondary,
                fontSize = 11.sp,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ── 保存ボタン ────────────────────────────────────────────

@Composable
private fun SaveButton(isSaving: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(if (!isSaving) AISColors.TextPrimary else AISColors.AccentSoft)
            .clickable(enabled = !isSaving) { onClick() }
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = if (isSaving) "保存中..." else "保存",
            color = Color.Black,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = 2.sp
        )
    }
}

// ── モードセレクター ──────────────────────────────────────

@Composable
private fun ModeSelector(selected: InterventionMode, onSelect: (InterventionMode) -> Unit) {
    Column {
        Text(
            text = "介入強度",
            color = AISColors.TextSecondary,
            fontSize = 11.sp,
            letterSpacing = 3.sp
        )
        Spacer(modifier = Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InterventionMode.entries.forEach { mode ->
                ModeChip(
                    label = mode.label,
                    selected = selected == mode,
                    onClick = { onSelect(mode) }
                )
            }
        }
    }
}

@Composable
private fun ModeChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text = label,
        color = if (selected) Color.Black else AISColors.TextSecondary,
        fontSize = 13.sp,
        fontWeight = if (selected) FontWeight.Medium else FontWeight.Light,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(if (selected) AISColors.ChipSelected else AISColors.ChipUnselected)
            .border(
                width = 1.dp,
                color = if (selected) Color.Transparent else AISColors.ChipBorderUnselected,
                shape = RoundedCornerShape(4.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp)
    )
}

// ── Overlay 権限バナー ────────────────────────────────────

@Composable
private fun OverlayPermissionBanner(onOpenSettings: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF1A1000))
            .border(1.dp, Color(0xFF3A2800), RoundedCornerShape(8.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "⚠ 表示権限が必要です",
                color = Color(0xFFFFAB40),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = "Hard モードで画面ON割り込みを使うには\n「他のアプリの上に表示」を許可してください",
                color = AISColors.TextSecondary,
                fontSize = 12.sp,
                lineHeight = 17.sp
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "設定",
            color = Color(0xFFFFAB40),
            fontSize = 13.sp,
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .border(1.dp, Color(0xFF3A2800), RoundedCornerShape(4.dp))
                .clickable { onOpenSettings() }
                .padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}
