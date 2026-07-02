package com.meishi.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.meishi.app.model.SnsType

/**
 * 追加するSNSの種類を選ぶダイアログ。主要SNS→区切り線→その他の順で表示する。
 * 「その他」を選んだ場合はサービス名を自由入力してもらう2段階ダイアログになる。
 */
@Composable
fun SnsPickerDialog(
    onDismiss: () -> Unit,
    onSelect: (type: SnsType, customServiceName: String) -> Unit
) {
    var pendingOther by remember { mutableStateOf(false) }

    if (pendingOther) {
        OtherServiceNameDialog(
            onDismiss = { pendingOther = false; onDismiss() },
            onConfirm = { name ->
                onSelect(SnsType.OTHER, name)
            }
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("SNSを追加") },
        text = {
            LazyColumn {
                items(SnsType.primary) { type ->
                    SnsPickerRow(type.displayName, type) { onSelect(type, "") }
                }
                item { Divider(modifier = Modifier.padding(vertical = 8.dp)) }
                items(SnsType.others) { type ->
                    if (type == SnsType.OTHER) {
                        SnsPickerRow("その他(名前を入力)", type) { pendingOther = true }
                    } else {
                        SnsPickerRow(type.displayName, type) { onSelect(type, "") }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("閉じる") }
        }
    )
}

@Composable
private fun OtherServiceNameDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("サービス名を入力") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                singleLine = true,
                placeholder = { Text("例: note, Threads など") }
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name.ifBlank { "その他" }) },
                enabled = true
            ) { Text("追加") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("キャンセル") }
        }
    )
}

@Composable
private fun SnsPickerRow(label: String, type: SnsType, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp, horizontal = 4.dp)
    ) {
        Icon(type.icon(), contentDescription = label, modifier = Modifier.size(22.dp))
        Text(label, modifier = Modifier.padding(start = 16.dp))
    }
}
