package com.meishi.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.meishi.app.model.Profile
import com.meishi.app.model.ProfileDraft
import com.meishi.app.model.SnsAccount
import com.meishi.app.model.SnsType
import com.meishi.app.ui.components.SnsEditorList
import com.meishi.app.ui.components.SnsPickerDialog
import com.meishi.app.ui.components.SnsRowData
import com.meishi.app.util.ImageUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(onBack: () -> Unit) {
    val context = LocalContext.current

    // 既存の下書きがあれば再開、なければ保存済みプロフィールから新規作成
    var draft by remember {
        mutableStateOf(ProfileDraft.findExisting() ?: ProfileDraft.createFrom(Profile.current()))
    }

    var name by remember { mutableStateOf(draft.name) }
    var email by remember { mutableStateOf(draft.email) }
    var phone by remember { mutableStateOf(draft.phone) }
    var address by remember { mutableStateOf(draft.address) }
    var iconPath by remember { mutableStateOf(draft.iconPath) }
    var snsRows by remember {
        mutableStateOf(draft.snsAccounts().map {
            SnsRowData(it.id.toString(), it.type, it.value, it.serviceName, it.displayLabel())
        })
    }
    var showSnsPicker by remember { mutableStateOf(false) }

    fun persistDraftHeader() {
        draft.name = name
        draft.email = email
        draft.phone = phone
        draft.address = address
        draft.iconPath = iconPath
        draft.save()
    }

    val iconPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            ImageUtil.saveIconFromUri(context, uri)?.let {
                iconPath = it
                persistDraftHeader()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("名刺を編集") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        // 元に戻す: 下書きを破棄して保存済みの内容で作り直す
                        draft.clear()
                        val fresh = ProfileDraft.createFrom(Profile.current())
                        draft = fresh
                        name = fresh.name
                        email = fresh.email
                        phone = fresh.phone
                        address = fresh.address
                        iconPath = fresh.iconPath
                        snsRows = fresh.snsAccounts().map {
                            SnsRowData(it.id.toString(), it.type, it.value, it.serviceName, it.displayLabel())
                        }
                    }) {
                        Icon(Icons.Filled.Restore, contentDescription = "元に戻す")
                    }
                    IconButton(onClick = {
                        // 保存: 下書きの内容を確定プロフィールへ反映し、下書きは破棄
                        val profile = Profile.current()
                        profile.name = name
                        profile.email = email
                        profile.phone = phone
                        profile.address = address
                        profile.iconPath = iconPath
                        profile.save()
                        SnsAccount.deleteAllFor(SnsAccount.TABLE_PROFILE, SnsAccount.COLUMN_PROFILE_ID, profile.id)
                        snsRows.forEachIndexed { index, row ->
                            SnsAccount.newForProfile(profile.id, row.type, row.value, index, row.serviceName).save()
                        }
                        draft.clear()
                        onBack()
                    }) {
                        Icon(Icons.Filled.Save, contentDescription = "保存")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.secondaryContainer, CircleShape)
                        .clickable { iconPicker.launch("image/*") }
                ) {
                    if (iconPath != null) {
                        AsyncImage(
                            model = iconPath,
                            contentDescription = "アイコン",
                            modifier = Modifier.size(96.dp)
                        )
                    } else {
                        Icon(Icons.Filled.Person, contentDescription = "アイコン未設定", modifier = Modifier.size(48.dp))
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; persistDraftHeader() },
                    label = { Text("名前") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; persistDraftHeader() },
                    label = { Text("メールアドレス") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it; persistDraftHeader() },
                    label = { Text("電話番号") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it; persistDraftHeader() },
                    label = { Text("住所") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("SNS / その他連絡先", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    IconButton(onClick = { showSnsPicker = true }) {
                        Icon(Icons.Filled.Add, contentDescription = "SNSを追加")
                    }
                }
            }

            SnsEditorList(
                items = snsRows,
                onChange = { newOrder ->
                    snsRows = newOrder
                    newOrder.forEachIndexed { index, row ->
                        SnsAccount.newForDraft(draft.id, row.type, row.value, index, row.serviceName).apply {
                            id = row.key.toLong()
                        }.save()
                    }
                },
                onValueChange = { key, newValue ->
                    snsRows = snsRows.map { if (it.key == key) it.copy(value = newValue) else it }
                    val target = snsRows.first { it.key == key }
                    SnsAccount.newForDraft(draft.id, target.type, newValue, 0, target.serviceName).apply {
                        id = key.toLong()
                    }.save()
                },
                onRemove = { key ->
                    SnsAccount.newForDraft(draft.id, SnsType.WEBSITE, "", 0).apply { id = key.toLong() }.delete()
                    snsRows = snsRows.filterNot { it.key == key }
                },
                modifier = Modifier.weight(1f)
            )
        }
    }

    if (showSnsPicker) {
        SnsPickerDialog(
            onDismiss = { showSnsPicker = false },
            onSelect = { type, customName ->
                val label = if (type == SnsType.OTHER) customName.ifBlank { "その他" } else type.displayName
                val newAccount = SnsAccount.newForDraft(draft.id, type, "", snsRows.size, customName)
                newAccount.save()
                snsRows = snsRows + SnsRowData(newAccount.id.toString(), type, "", customName, label)
                showSnsPicker = false
            }
        )
    }
}
