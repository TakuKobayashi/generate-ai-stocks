package com.meishi.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.meishi.app.model.Contact
import com.meishi.app.nearby.NearbyTransferManager
import com.meishi.app.nfc.NfcReaderBus
import com.meishi.app.ui.components.QrScannerView
import com.meishi.app.util.CardExchangeUtil
import com.meishi.app.util.CardPayload

private enum class ReceiveTab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    QR("QRコード", Icons.Filled.QrCodeScanner),
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
fun ReceiveScreen(onBack: () -> Unit, onReceived: (Long) -> Unit) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(ReceiveTab.QR) }

    fun handlePayloadBytes(bytes: ByteArray) {
        try {
            val payload = CardPayload.fromMessagePack(bytes)
            val contact = CardExchangeUtil.saveAsContact(context, payload)
            onReceived(contact.id)
        } catch (e: Exception) {
            // 不正なデータは無視する
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("名刺を受信") },
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
                ReceiveTab.values().forEach { tab ->
                    Tab(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        text = { Text(tab.title) },
                        icon = { Icon(tab.icon, contentDescription = tab.title) }
                    )
                }
            }

            when (selectedTab) {
                ReceiveTab.QR -> QrReceiveTab(::handlePayloadBytes)
                ReceiveTab.NEARBY -> NearbyReceiveTab(::handlePayloadBytes)
                ReceiveTab.NFC -> NfcReceiveTab(::handlePayloadBytes)
            }
        }
    }
}

@Composable
private fun QrReceiveTab(onPayload: (ByteArray) -> Unit) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCameraPermission = granted }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (hasCameraPermission) {
            QrScannerView(modifier = Modifier.fillMaxSize(), onDetected = onPayload)
        } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("QRコードを読み取るためにカメラの使用を許可してください。")
                Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("カメラを許可する")
                }
            }
        }
    }
}

@Composable
private fun NearbyReceiveTab(onPayload: (ByteArray) -> Unit) {
    val context = LocalContext.current
    var permissionGranted by remember {
        mutableStateOf(NEARBY_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        })
    }
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

    var endpoints by remember { mutableStateOf(listOf<Pair<String, String>>()) }
    var status by remember { mutableStateOf("周囲のデバイスを検索しています…") }

    val manager = remember {
        NearbyTransferManager(
            context = context,
            localName = "Meishi User",
            onEndpointFound = { id, name -> endpoints = endpoints + (id to name) },
            onConnected = { status = "接続しました。受信を待っています…" },
            onPayloadReceived = onPayload,
            onError = { status = it }
        )
    }

    DisposableEffect(Unit) {
        manager.startDiscovery(NearbyTransferManager.SERVICE_ID)
        onDispose { manager.stopAll() }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(status, style = MaterialTheme.typography.bodyMedium)
        Spacer(modifier = Modifier.height(12.dp))
        if (endpoints.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn {
                items(endpoints, key = { it.first }) { (id, name) ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { manager.requestConnection(id) }
                            .padding(vertical = 12.dp)
                    ) {
                        Text(name.ifBlank { "(名前未設定の端末)" }, style = MaterialTheme.typography.titleMedium)
                        Text("タップして接続", style = MaterialTheme.typography.bodySmall)
                    }
                    Divider()
                }
            }
        }
    }
}

@Composable
private fun NfcReceiveTab(onPayload: (ByteArray) -> Unit) {
    val context = LocalContext.current
    var permissionGranted by remember {
        mutableStateOf(NEARBY_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        })
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result -> permissionGranted = result.values.all { it } }

    LaunchedEffect(Unit) {
        if (!permissionGranted) permissionLauncher.launch(NEARBY_PERMISSIONS)
    }

    var status by remember { mutableStateOf("相手の端末にスマートフォンの背面をタップしてください") }
    var targetToken by remember { mutableStateOf<String?>(null) }

    val manager = remember {
        NearbyTransferManager(
            context = context,
            localName = "Meishi Reader",
            onEndpointFound = { id, name ->
                if (name == targetToken) {
                    status = "デバイスを発見しました。接続しています…"
                    manager.requestConnection(id)
                }
            },
            onConnected = { status = "接続しました。受信を待っています…" },
            onPayloadReceived = onPayload,
            onError = { status = it }
        )
    }

    DisposableEffect(permissionGranted) {
        onDispose { manager.stopAll() }
    }

    LaunchedEffect(permissionGranted) {
        if (!permissionGranted) return@LaunchedEffect
        NfcReaderBus.tokens.collect { token ->
            targetToken = token
            status = "NFCタップを検出しました。Bluetooth/Wi-Fiで接続しています…"
            manager.startDiscovery(NearbyTransferManager.SERVICE_ID)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Filled.Contactless, contentDescription = null, modifier = Modifier.size(80.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text(status, style = MaterialTheme.typography.titleMedium)
    }
}
