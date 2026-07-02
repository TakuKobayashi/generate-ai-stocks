package com.meishi.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.meishi.app.model.Profile
import com.meishi.app.nearby.NearbyTransferManager
import com.meishi.app.nfc.NfcAdvertiseBridge
import com.meishi.app.util.CardExchangeUtil
import com.meishi.app.util.QrCodeGenerator
import kotlin.random.Random

private enum class SendTab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    QR("QRコード", Icons.Filled.QrCode),
    NEARBY("近くのデバイス", Icons.Filled.Bluetooth),
    NFC("NFCタップ", Icons.Filled.Contactless)
}

private val NEARBY_PERMISSIONS: Array<String> = if (Build.VERSION.SDK_INT >= 31) {
    arrayOf(
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN
    )
} else {
    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SendScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val profile = remember { Profile.current() }
    val payload = remember { CardExchangeUtil.buildPayload(profile) }
    val payloadBytes = remember { payload.toMessagePack() }

    var selectedTab by remember { mutableStateOf(SendTab.QR) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("名刺を送信") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "戻る")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = selectedTab.ordinal) {
                SendTab.values().forEach { tab ->
                    Tab(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        text = { Text(tab.title) },
                        icon = { Icon(tab.icon, contentDescription = tab.title) }
                    )
                }
            }

            when (selectedTab) {
                SendTab.QR -> QrSendTab(profile.name, payloadBytes)
                SendTab.NEARBY -> NearbySendTab(profile.name, payloadBytes)
                SendTab.NFC -> NfcSendTab(profile.name, payloadBytes)
            }
        }
    }
}

@Composable
private fun QrSendTab(name: String, payloadBytes: ByteArray) {
    val qrBitmap = remember { QrCodeGenerator.generate(payloadBytes).asImageBitmap() }
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(name.ifBlank { "(名前未設定)" }, style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(24.dp))
        Image(bitmap = qrBitmap, contentDescription = "自分の名刺QRコード", modifier = Modifier.size(280.dp))
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            "相手に「受信」画面のQRタブでこのコードをスキャンしてもらってください。アカウント登録は不要です。",
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun NearbySendTab(name: String, payloadBytes: ByteArray) {
    val context = LocalContext.current
    var permissionGranted by remember {
        mutableStateOf(NEARBY_PERMISSIONS.all {
            androidx.core.content.ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        })
    }
    var status by remember { mutableStateOf("広告を開始しています…") }
    var receivedCount by remember { mutableStateOf(0) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result -> permissionGranted = result.values.all { it } }

    LaunchedEffect(Unit) {
        if (!permissionGranted) permissionLauncher.launch(NEARBY_PERMISSIONS)
    }

    if (!permissionGranted) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Bluetooth/位置情報の権限が必要です")
        }
        return
    }

    val manager = remember {
        NearbyTransferManager(
            context = context,
            localName = name.ifBlank { "Meishi User" },
            onEndpointFound = { _, _ -> },
            onConnected = { status = "接続しました。送信中…" },
            onPayloadReceived = { /* 送信側は基本受け取らない */ },
            onError = { status = it }
        )
    }

    DisposableEffect(Unit) {
        manager.setOutgoingPayload(payloadBytes)
        manager.startAdvertising(NearbyTransferManager.SERVICE_ID)
        status = "周囲のデバイスからの接続を待っています…"
        onDispose { manager.stopAll() }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CircularProgressIndicator()
        Spacer(modifier = Modifier.height(16.dp))
        Text(status, style = MaterialTheme.typography.bodyLarge)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "相手の「受信」画面の「近くのデバイス」タブから見つけて接続してもらってください。",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun NfcSendTab(name: String, payloadBytes: ByteArray) {
    val context = LocalContext.current
    val sessionToken = remember { (1..6).map { Random.nextInt(0, 10) }.joinToString("") }

    var permissionGranted by remember {
        mutableStateOf(NEARBY_PERMISSIONS.all {
            androidx.core.content.ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        })
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result -> permissionGranted = result.values.all { it } }

    LaunchedEffect(Unit) {
        if (!permissionGranted) permissionLauncher.launch(NEARBY_PERMISSIONS)
    }

    val manager = remember {
        NearbyTransferManager(
            context = context,
            localName = sessionToken,
            onEndpointFound = { _, _ -> },
            onConnected = {},
            onPayloadReceived = {},
        )
    }

    DisposableEffect(permissionGranted) {
        if (permissionGranted) {
            NfcAdvertiseBridge.currentToken = sessionToken
            manager.setOutgoingPayload(payloadBytes)
            manager.startAdvertising(NearbyTransferManager.SERVICE_ID)
        }
        onDispose {
            NfcAdvertiseBridge.currentToken = null
            manager.stopAll()
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Filled.Contactless, contentDescription = null, modifier = Modifier.size(80.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text("相手の端末をこの画面の背面にタップしてください", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "NFCタップでBluetooth/Wi-Fi(Nearby)接続の合図を送り、その後自動的に名刺データを送信します。",
            style = MaterialTheme.typography.bodySmall
        )
    }
}
