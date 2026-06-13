package com.offlinechat.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.offlinechat.data.models.ChatRoom
import com.offlinechat.ui.viewmodels.MainViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: MainViewModel,
    onOpenRoom: (ChatRoom) -> Unit,
    onBack: () -> Unit
) {
    val rooms by viewModel.chatRooms.collectAsState()
    val nearbyPeers by viewModel.nearbyPeers.collectAsState()
    val nearbyIds = nearbyPeers.map { it.userId }.toSet()

    LaunchedEffect(Unit) { viewModel.loadChatRooms() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("チャット") },
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
                    val isOnline = room.peerUserId in nearbyIds
                    val isNew = room.lastMessage == null && !room.isRequestPending

                    ChatRoomItem(
                        displayName = peerUser?.displayName ?: room.peerUserId,
                        lastMessage = when {
                            room.isRequestPending -> "リクエスト送信中..."
                            room.lastMessage != null -> room.lastMessage!!
                            else -> "メッセージなし"
                        },
                        lastTime = room.lastMessageTime,
                        unreadCount = room.unreadCount,
                        isOnline = isOnline,
                        isNew = isNew,
                        isPending = room.isRequestPending,
                        onClick = { onOpenRoom(room) }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
fun ChatRoomItem(
    displayName: String,
    lastMessage: String,
    lastTime: Long?,
    unreadCount: Int,
    isOnline: Boolean,
    isNew: Boolean,
    isPending: Boolean,
    onClick: () -> Unit
) {
    val bg = if (unreadCount > 0) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)
             else MaterialTheme.colorScheme.surface
    Row(
        Modifier.fillMaxWidth().background(bg).clickable(onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            Box(
                Modifier.size(52.dp).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(displayName.firstOrNull()?.toString() ?: "?",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
            if (isOnline) Box(
                Modifier.size(14.dp).clip(CircleShape).background(Color(0xFF4CAF50))
                    .align(Alignment.BottomEnd)
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(displayName, fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                if (lastTime != null) Text(formatTime(lastTime),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(lastMessage, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                when {
                    isNew -> Badge { Text("NEW") }
                    isPending -> Text("⏳", style = MaterialTheme.typography.bodySmall)
                    unreadCount > 0 -> Badge(containerColor = MaterialTheme.colorScheme.error) {
                        Text(if (unreadCount > 99) "99+" else "$unreadCount")
                    }
                }
            }
        }
    }
}

private fun formatTime(ts: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - ts
    return when {
        diff < 60_000 -> "今"
        diff < 3_600_000 -> "${diff / 60_000}分前"
        diff < 86_400_000 -> SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts))
        else -> SimpleDateFormat("MM/dd", Locale.getDefault()).format(Date(ts))
    }
}
