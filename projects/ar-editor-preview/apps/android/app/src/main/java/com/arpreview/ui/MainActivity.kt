// apps/android/app/src/main/java/com/arpreview/ui/MainActivity.kt

package com.arpreview.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {

    private val viewModel: ARPreviewViewModel by viewModels()

    private val requestPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) viewModel.connect()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ARPreviewScreen(
                        viewModel      = viewModel,
                        onConnectClick = ::connectWithPermission,
                    )
                }
            }
        }
    }

    override fun onResume() { super.onResume(); viewModel.onResume() }
    override fun onPause()  { super.onPause();  viewModel.onPause()  }

    private fun connectWithPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            viewModel.connect()
        } else {
            requestPermission.launch(Manifest.permission.CAMERA)
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// Compose 画面
// ─────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ARPreviewScreen(
    viewModel: ARPreviewViewModel,
    onConnectClick: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var tokenVisible by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("AR Editor Preview") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatusCard(uiState)

            // ── 接続設定 ─────────────────────────────────────────
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("接続設定", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        value = uiState.serverUrl, onValueChange = viewModel::onServerUrlChanged,
                        label = { Text("Server URL") }, placeholder = { Text("ws://192.168.x.x:7880") },
                        enabled = !uiState.isConnected, modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), singleLine = true,
                    )
                    OutlinedTextField(
                        value = uiState.roomName, onValueChange = viewModel::onRoomNameChanged,
                        label = { Text("Room Name") }, enabled = !uiState.isConnected,
                        modifier = Modifier.fillMaxWidth(), singleLine = true,
                    )
                    OutlinedTextField(
                        value = uiState.token, onValueChange = viewModel::onTokenChanged,
                        label = { Text("JWT Token") }, placeholder = { Text("省略時: 自動生成 (dev モード)") },
                        enabled = !uiState.isConnected, modifier = Modifier.fillMaxWidth(), maxLines = 2,
                        visualTransformation = if (tokenVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            TextButton(onClick = { tokenVisible = !tokenVisible }) {
                                Text(if (tokenVisible) "隠す" else "表示")
                            }
                        }
                    )
                }
            }

            // ── アクション ───────────────────────────────────────
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onConnectClick,
                    enabled = !uiState.isConnected && !uiState.isConnecting,
                    modifier = Modifier.weight(1f).height(48.dp),
                ) {
                    if (uiState.isConnecting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp), strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(if (uiState.isConnecting) "接続中..." else "接続")
                }
                OutlinedButton(
                    onClick = viewModel::disconnect,
                    enabled = uiState.isConnected,
                    modifier = Modifier.weight(1f).height(48.dp),
                ) { Text("切断") }
            }

            // ── エラー ───────────────────────────────────────────
            uiState.errorMessage?.let { err ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, null, tint = MaterialTheme.colorScheme.onErrorContainer)
                        Text(err, color = MaterialTheme.colorScheme.onErrorContainer,
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            if (!uiState.isConnected && !uiState.isConnecting) SetupGuide()
        }
    }
}

@Composable
private fun StatusCard(state: ARPreviewUiState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (state.isConnected)
                MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant,
        )
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = if (state.isConnected) Icons.Default.CheckCircle else Icons.Default.Warning,
                contentDescription = null,
                tint = if (state.isConnected) Color(0xFF4CAF50) else Color(0xFFFF9800),
                modifier = Modifier.size(28.dp),
            )
            Column {
                Text(if (state.isConnected) "接続中" else "未接続", style = MaterialTheme.typography.titleSmall)
                if (state.isConnected) {
                    Text(
                        "送信フレーム: ${state.frameCount}  |  プレーン: ${state.planeCount}  |  " +
                        "RTT: ${if (state.rttMs >= 0) "%.1f ms".format(state.rttMs) else "--"}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun SetupGuide() {
    Card(modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("セットアップ手順", style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(4.dp))
            listOf(
                "1. PC で docker compose up -d を実行",
                "2. Unity Editor で Window > AR Editor Preview を開く",
                "3. Server URL を PC の IP アドレスに設定",
                "4. Unity で Play ▶ を押す",
                "5. このアプリで「接続」をタップ",
            ).forEach {
                Text(it, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
