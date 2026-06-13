package com.offlinechat.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.offlinechat.ui.viewmodels.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: MainViewModel,
    onPastChats: () -> Unit,
    onBack: () -> Unit
) {
    val me by viewModel.me.collectAsState()
    var displayName by remember(me) { mutableStateOf(me?.displayName ?: "") }
    var bio by remember(me) { mutableStateOf(me?.bio ?: "") }
    var isDiscoverable by remember(me) { mutableStateOf(me?.isDiscoverable ?: true) }
    var saved by remember { mutableStateOf(false) }

    val iconPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            viewModel.updateProfile(displayName, bio.ifBlank { null }, it.toString())
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("設定") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "戻る")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // アイコン
            Box(Modifier.align(Alignment.CenterHorizontally)) {
                Box(
                    Modifier.size(96.dp).clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        me?.displayName?.firstOrNull()?.toString() ?: "?",
                        style = MaterialTheme.typography.displaySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                FilledIconButton(
                    onClick = { iconPicker.launch("image/*") },
                    modifier = Modifier.align(Alignment.BottomEnd).size(32.dp)
                ) {
                    Icon(Icons.Default.CameraAlt, "アイコン変更",
                        modifier = Modifier.size(16.dp))
                }
            }

            // ユーザーID表示
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("ユーザーID", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(me?.id ?: "", style = MaterialTheme.typography.bodySmall)
                }
            }

            // 表示名
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it; saved = false },
                label = { Text("表示名") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Bio
            OutlinedTextField(
                value = bio,
                onValueChange = { bio = it; saved = false },
                label = { Text("自己紹介 (Bio)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3
            )

            // 発見可能
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("ユーザー一覧に表示", style = MaterialTheme.typography.bodyLarge)
                    Text("オフにすると近くの人に見えなくなります",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(
                    checked = isDiscoverable,
                    onCheckedChange = {
                        isDiscoverable = it
                        viewModel.setDiscoverable(it)
                    }
                )
            }

            HorizontalDivider()

            // 保存
            Button(
                onClick = {
                    viewModel.updateProfile(displayName, bio.ifBlank { null }, me?.iconPath)
                    saved = true
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = displayName.isNotBlank()
            ) {
                Text(if (saved) "✓ 保存済み" else "保存")
            }

            // 過去のチャット
            OutlinedButton(
                onClick = onPastChats,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("過去にやり取りした人を管理")
            }
        }
    }
}
