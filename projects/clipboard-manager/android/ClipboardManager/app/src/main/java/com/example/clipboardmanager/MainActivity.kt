package com.example.clipboardmanager

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.clipboardmanager.ads.AdManager
import com.example.clipboardmanager.billing.PremiumManager
import com.example.clipboardmanager.data.AppDatabase
import com.example.clipboardmanager.data.ClipboardItem
import com.example.clipboardmanager.repository.ClipboardRepository
import com.example.clipboardmanager.service.ClipboardMonitorService
import com.example.clipboardmanager.ui.theme.ClipboardManagerTheme
import com.example.clipboardmanager.viewmodel.ClipboardViewModel
import com.example.clipboardmanager.viewmodel.ClipboardViewModelFactory
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {
    private lateinit var premiumManager: PremiumManager
    private lateinit var adManager: AdManager

    private val viewModel: ClipboardViewModel by viewModels {
        ClipboardViewModelFactory(
            ClipboardRepository(AppDatabase.getDatabase(applicationContext).clipboardDao(), applicationContext)
        )
    }

    private val requestPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) ClipboardMonitorService.start(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        premiumManager = PremiumManager.getInstance(this)
        adManager = AdManager.getInstance(this)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            ClipboardMonitorService.start(this)
        }

        setContent {
            ClipboardManagerTheme {
                val isPremium by premiumManager.isPremium.collectAsState()
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MainScreen(viewModel, isPremium, adManager,
                        onPurchase = { productId -> premiumManager.launchPurchaseFlow(this, productId) },
                        onRestorePurchases = { premiumManager.restorePurchases() }
                    )
                }
            }
        }
    }

    override fun onDestroy() { super.onDestroy(); premiumManager.cleanup() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: ClipboardViewModel,
    isPremium: Boolean,
    adManager: AdManager,
    onPurchase: (String) -> Unit,
    onRestorePurchases: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showPremiumSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("クリップボード履歴") },
                actions = {
                    if (!isPremium) {
                        IconButton(onClick = { showPremiumSheet = true }) {
                            Icon(Icons.Default.Star, contentDescription = "Premium", tint = MaterialTheme.colorScheme.primary)
                        }
                    } else {
                        Icon(Icons.Default.Star, contentDescription = "Premium", tint = androidx.compose.ui.graphics.Color(0xFFFFD700),
                            modifier = Modifier.padding(end = 12.dp))
                    }
                    if (uiState.isSelectionMode) {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "削除")
                        }
                        IconButton(onClick = { viewModel.toggleSelectionMode() }) {
                            Icon(Icons.Default.Close, contentDescription = "キャンセル")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            SearchBar(query = uiState.searchQuery, onQueryChange = viewModel::updateSearchQuery)
            SortRow(currentSortBy = uiState.sortBy, ascending = uiState.ascending, onSortChange = viewModel::updateSort)
            if (!isPremium) BannerAd(adManager)
            ClipboardList(
                items = uiState.items,
                selectedItems = uiState.selectedItems,
                isSelectionMode = uiState.isSelectionMode,
                isPremium = isPremium,
                onItemClick = { item ->
                    if (uiState.isSelectionMode) viewModel.toggleItemSelection(item.id)
                    else viewModel.copyToClipboard(item)
                },
                onItemLongClick = { item ->
                    if (!uiState.isSelectionMode) { viewModel.toggleSelectionMode(); viewModel.toggleItemSelection(item.id) }
                },
                onUpgradeClick = { showPremiumSheet = true }
            )
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("削除確認") },
            text = { Text("${uiState.selectedItems.size}件を削除しますか？") },
            confirmButton = { TextButton(onClick = { viewModel.deleteSelectedItems(); showDeleteDialog = false }) { Text("削除") } },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("キャンセル") } }
        )
    }

    if (showPremiumSheet) {
        PremiumBottomSheet(
            onDismiss = { showPremiumSheet = false },
            onPurchase = onPurchase,
            onRestorePurchases = onRestorePurchases
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchBar(query: String, onQueryChange: (String) -> Unit) {
    OutlinedTextField(
        value = query, onValueChange = onQueryChange,
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        placeholder = { Text("検索（2文字以上）") },
        leadingIcon = { Icon(Icons.Default.Search, null) },
        trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { onQueryChange("") }) { Icon(Icons.Default.Clear, null) } },
        shape = RoundedCornerShape(12.dp), singleLine = true
    )
}

@Composable
fun SortRow(currentSortBy: String, ascending: Boolean, onSortChange: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("作成日時" to "created_at", "最終使用" to "last_used_at", "使用回数" to "usage_count").forEach { (label, key) ->
            val active = currentSortBy == key
            Button(
                onClick = { onSortChange(key) },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                ),
                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
            ) {
                Icon(
                    if (active && ascending) Icons.Default.KeyboardArrowUp else if (active) Icons.Default.KeyboardArrowDown else Icons.Default.Sort,
                    null, Modifier.size(14.dp)
                )
                Spacer(Modifier.width(2.dp))
                Text(label, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
fun BannerAd(adManager: AdManager) {
    AndroidView(factory = { adManager.createBannerAdView() },
        modifier = Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 8.dp))
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ClipboardList(
    items: List<ClipboardItem>, selectedItems: Set<Long>, isSelectionMode: Boolean,
    isPremium: Boolean, onItemClick: (ClipboardItem) -> Unit, onItemLongClick: (ClipboardItem) -> Unit,
    onUpgradeClick: () -> Unit
) {
    val displayItems = if (!isPremium && items.size > 50) items.take(50) else items
    if (displayItems.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("クリップボード履歴がありません", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    } else {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(displayItems, key = { it.id }) { item ->
                ClipboardItemCard(item, selectedItems.contains(item.id), isSelectionMode,
                    { onItemClick(item) }, { onItemLongClick(item) })
            }
            if (!isPremium && items.size > 50) {
                item {
                    Card(modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                        onClick = onUpgradeClick) {
                        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Star, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(4.dp))
                            Text("プレミアムで${items.size - 50}件の追加履歴を表示", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ClipboardItemCard(item: ClipboardItem, isSelected: Boolean, isSelectionMode: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().combinedClickable(onClick = onClick, onLongClick = onLongClick),
        colors = CardDefaults.cardColors(containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            if (isSelectionMode) {
                Checkbox(checked = isSelected, onCheckedChange = null)
            } else {
                Box(Modifier.size(40.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), Alignment.Center) {
                    Text("${item.usageCount}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.content, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Text("作成: ${formatDate(item.createdAt)}  最終: ${formatDate(item.lastUsedAt)}",
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumBottomSheet(onDismiss: () -> Unit, onPurchase: (String) -> Unit, onRestorePurchases: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Star, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(12.dp))
            Text("プレミアムにアップグレード", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(20.dp))
            listOf("広告なし" to Icons.Default.Close, "無制限の履歴" to Icons.Default.List,
                   "高度な検索" to Icons.Default.Search, "テーマカスタマイズ" to Icons.Default.Settings).forEach { (text, icon) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(16.dp))
                    Text(text, style = MaterialTheme.typography.bodyLarge)
                }
            }
            Spacer(Modifier.height(24.dp))
            Card(Modifier.fillMaxWidth(), onClick = { onPurchase(PremiumManager.MONTHLY_SUBSCRIPTION) },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.padding(16.dp)) {
                    Text("月額プラン", style = MaterialTheme.typography.titleMedium)
                    Text("¥300 / 月", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
            Spacer(Modifier.height(12.dp))
            Card(Modifier.fillMaxWidth(), onClick = { onPurchase(PremiumManager.YEARLY_SUBSCRIPTION) },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.padding(16.dp)) {
                    Text("年額プラン", style = MaterialTheme.typography.titleMedium)
                    Text("¥2,400 / 年", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                    Text("2ヶ月分お得！", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(12.dp))
            TextButton(onClick = onRestorePurchases) { Text("購入を復元") }
            Spacer(Modifier.height(24.dp))
        }
    }
}

fun formatDate(date: Date): String = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault()).format(date)
