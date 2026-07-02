package com.meishi.app.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.meishi.app.model.Contact
import com.meishi.app.ui.components.icon

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactDetailScreen(contactId: Long, onBack: () -> Unit) {
    val contact = remember { Contact.find(contactId) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("連絡先の詳細") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = { showDeleteConfirm = true }) {
                        Icon(Icons.Filled.Delete, contentDescription = "削除")
                    }
                }
            )
        }
    ) { padding ->
        if (contact == null) {
            Column(modifier = Modifier.fillMaxSize().padding(padding), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("連絡先が見つかりませんでした")
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProfileIcon(contact.iconPath, size = 80.dp)
                Spacer(modifier = Modifier.width(16.dp))
                Text(contact.name.ifBlank { "(名前未設定)" }, style = MaterialTheme.typography.headlineSmall)
            }
            Spacer(modifier = Modifier.height(24.dp))

            ReadOnlyField("メールアドレス", contact.email)
            ReadOnlyField("電話番号", contact.phone)
            ReadOnlyField("住所", contact.address)

            val snsList = remember { contact.snsAccounts() }
            if (snsList.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("SNS / その他連絡先", style = MaterialTheme.typography.titleMedium)
                Divider(modifier = Modifier.padding(vertical = 8.dp))
                snsList.forEach { sns ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                    ) {
                        Icon(sns.type.icon(), contentDescription = sns.type.displayName, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(sns.type.displayName, style = MaterialTheme.typography.labelMedium)
                            Text(sns.value.ifBlank { "未設定" }, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }

        if (showDeleteConfirm) {
            AlertDialog(
                onDismissRequest = { showDeleteConfirm = false },
                title = { Text("削除しますか?") },
                text = { Text("「${contact.name}」を連絡先から削除します。この操作は元に戻せません。") },
                confirmButton = {
                    TextButton(onClick = {
                        contact.delete()
                        showDeleteConfirm = false
                        onBack()
                    }) { Text("削除する") }
                },
                dismissButton = {
                    TextButton(onClick = { showDeleteConfirm = false }) { Text("キャンセル") }
                }
            )
        }
    }
}

@Composable
private fun ReadOnlyField(label: String, value: String) {
    Column(modifier = Modifier.padding(vertical = 6.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.outline)
        Text(value.ifBlank { "未設定" }, style = MaterialTheme.typography.bodyLarge)
    }
}
