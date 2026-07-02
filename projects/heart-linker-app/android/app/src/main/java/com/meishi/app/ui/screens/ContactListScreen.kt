package com.meishi.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.meishi.app.model.Contact
import com.meishi.app.model.Profile

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactListScreen(
    onEditProfile: () -> Unit,
    onSend: () -> Unit,
    onReceive: () -> Unit,
    onOpenContact: (Long) -> Unit
) {
    var profile by remember { mutableStateOf(Profile.current()) }
    var contacts by remember { mutableStateOf(Contact.findAll()) }

    // 画面に戻ってくるたびに最新化
    LaunchedEffect(Unit) {
        profile = Profile.current()
        contacts = Contact.findAll()
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("名刺帳") })
        },
        floatingActionButton = {
            Column(horizontalAlignment = Alignment.End) {
                ExtendedFloatingActionButton(
                    onClick = onSend,
                    icon = { Icon(Icons.Filled.QrCode, contentDescription = null) },
                    text = { Text("送信(QR表示)") }
                )
                Spacer(modifier = Modifier.height(12.dp))
                ExtendedFloatingActionButton(
                    onClick = onReceive,
                    icon = { Icon(Icons.Filled.QrCodeScanner, contentDescription = null) },
                    text = { Text("受信(QR読取)") }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Card(
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .clickable { onEditProfile() }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(16.dp)
                ) {
                    ProfileIcon(profile.iconPath, size = 56.dp)
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = profile.name.ifBlank { "(自分の名刺を入力)" },
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = profile.email.ifBlank { "未設定" },
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    IconButton(onClick = onEditProfile) {
                        Icon(Icons.Filled.Edit, contentDescription = "編集")
                    }
                }
            }

            Text(
                "交換した連絡先",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            if (contacts.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("まだ連絡先がありません。「受信」から交換しましょう。")
                }
            } else {
                LazyColumn {
                    items(contacts, key = { it.id }) { contact ->
                        ContactRow(contact, onClick = { onOpenContact(contact.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ContactRow(contact: Contact, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        ProfileIcon(contact.iconPath, size = 48.dp)
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(contact.name.ifBlank { "(名前未設定)" }, style = MaterialTheme.typography.titleMedium)
            val sub = listOf(contact.email, contact.phone).filter { it.isNotBlank() }.joinToString(" / ")
            if (sub.isNotBlank()) {
                Text(sub, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
fun ProfileIcon(iconPath: String?, size: Dp) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.secondaryContainer, CircleShape)
    ) {
        if (!iconPath.isNullOrBlank()) {
            AsyncImage(model = iconPath, contentDescription = "アイコン", modifier = Modifier.size(size))
        } else {
            Icon(Icons.Filled.Person, contentDescription = null)
        }
    }
}
