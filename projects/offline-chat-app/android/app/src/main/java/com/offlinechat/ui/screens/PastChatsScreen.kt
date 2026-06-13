package com.offlinechat.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.offlinechat.data.models.ChatRoom
import com.offlinechat.ui.viewmodels.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PastChatsScreen(
    viewModel: MainViewModel,
    onBack: () -> Unit
) {
    val rooms by viewModel.chatRooms.collectAsState()
    var confirmDelete by remember { mutableStateOf<ChatRoom?>(null) }

    LaunchedEffect(Unit) { viewModel.loadChatRooms() }

    confirmDelete?.let { room ->
        val peer = viewModel.peerUserForRoom(room)
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text("チャット履歴を削除") },
            text = { Text("${peer?.displayName ?: "このユーザー"}との履歴をすべて削除しますか？") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteChatRoom(room)
                    confirmDelete = null
                }) { Text("削除", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = null }) { Text("キャンセル") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("過去にやり取りした人") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "戻る")
                    }
                }
            )
        }
    ) { padding ->
        if (rooms.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("チャット履歴がありません")
            }
        } else {
            LazyColumn(Modifier.fillMaxSize().padding(padding)) {
                items(rooms, key = { it.id }) { room ->
                    val peerUser = viewModel.peerUserForRoom(room)
                    ListItem(
                        headlineContent = {
                            Text(peerUser?.displayName ?: room.peerUserId)
                        },
                        supportingContent = {
                            Text(room.lastMessage ?: "メッセージなし",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        },
                        leadingContent = {
                            Box(
                                Modifier.size(40.dp).clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.secondaryContainer),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    peerUser?.displayName?.firstOrNull()?.toString() ?: "?",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer
                                )
                            }
                        },
                        trailingContent = {
                            IconButton(onClick = { confirmDelete = room }) {
                                Icon(Icons.Default.Delete, "削除",
                                    tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}
