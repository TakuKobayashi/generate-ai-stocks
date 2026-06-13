package com.offlinechat.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.offlinechat.data.models.NearbyPeer
import com.offlinechat.ui.viewmodels.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: MainViewModel,
    onOpenChat: (String) -> Unit,
    onChatList: () -> Unit,
    onSettings: () -> Unit
) {
    val nearby by viewModel.nearbyPeers.collectAsState()
    val me by viewModel.me.collectAsState()
    val requests by viewModel.pendingRequests.collectAsState()

    // リクエストダイアログ
    requests.firstOrNull()?.let { req ->
        AlertDialog(
            onDismissRequest = { viewModel.declineRequest(req) },
            title = { Text("チャットリクエスト") },
            text = { Text("${req.fromDisplayName} からチャットのリクエストが届きました") },
            confirmButton = {
                TextButton(onClick = { viewModel.acceptRequest(req) }) { Text("許可") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.declineRequest(req) }) { Text("拒否") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("近くの人") },
                actions = {
                    IconButton(onClick = onChatList) {
                        Icon(Icons.Default.Chat, "チャット一覧")
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, "設定")
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            // 簡易地図プレースホルダー
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "📍 ${me?.displayName ?: "自分"}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "地図はGoogle Maps APIキー設定後に表示されます",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            HorizontalDivider()

            if (nearby.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📡", style = MaterialTheme.typography.displayMedium)
                        Spacer(Modifier.height(8.dp))
                        Text("近くにユーザーが見つかりません",
                            style = MaterialTheme.typography.bodyLarge)
                        Text("アプリを起動しているユーザーを探しています…",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(8.dp)) {
                    items(nearby, key = { it.endpointId }) { peer ->
                        NearbyPeerCard(peer = peer, onClick = { onOpenChat(peer.userId) })
                    }
                }
            }
        }
    }
}

@Composable
private fun NearbyPeerCard(peer: NearbyPeer, onClick: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(4.dp).clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(48.dp).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    peer.displayName.firstOrNull()?.toString() ?: "?",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(peer.displayName, fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyLarge)
                if (!peer.bio.isNullOrEmpty()) {
                    Text(peer.bio!!, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Box(
                Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF4CAF50))
            )
        }
    }
}
