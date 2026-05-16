package com.example.nomikai.ui.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.example.nomikai.data.api.models.Restaurant
import com.example.nomikai.ui.theme.BeerAmber
import com.example.nomikai.ui.viewmodels.CreateInviteViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalPermissionsApi::class, ExperimentalMaterial3Api::class)
@Composable
fun CreateInviteScreen(
    onNavigateToNotifications: () -> Unit,
    viewModel: CreateInviteViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    val locationPermission = rememberPermissionState(Manifest.permission.ACCESS_FINE_LOCATION)

    LaunchedEffect(locationPermission.status.isGranted) {
        if (locationPermission.status.isGranted) {
            viewModel.fetchCurrentLocation()
        }
    }

    // 送信成功ダイアログ
    if (uiState.sendResult != null) {
        AlertDialog(
            onDismissRequest = { viewModel.clearSendResult() },
            icon = { Text("🍺", fontSize = 36.sp) },
            title = { Text("送信完了！") },
            text = {
                Text("${uiState.sendResult!!.notifiedCount}人の友達に通知しました！\n一緒に飲みましょう🎉")
            },
            confirmButton = {
                TextButton(onClick = { viewModel.clearSendResult() }) { Text("OK") }
            }
        )
    }

    // エラーSnackbar
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            // Snackbar代わりにダイアログで表示
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🍺", fontSize = 20.sp)
                        Spacer(Modifier.width(8.dp))
                        Text("飲みに行きたい！", fontWeight = FontWeight.Bold)
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        BadgedBox(badge = {
                            if (uiState.sendResult != null) {
                                Badge { Text("!") }
                            }
                        }) {
                            Icon(Icons.Default.Notifications, contentDescription = "通知")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BeerAmber,
                    titleContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ① 日時設定
            item {
                DateTimeSection(
                    dateTime = uiState.dateTime,
                    onDateTimeChanged = viewModel::setDateTime
                )
            }

            // ② 募集人数
            item {
                ParticipantCountSection(
                    count = uiState.participantCount,
                    onCountChange = viewModel::setParticipantCount
                )
            }

            // ③ 場所（オプション・マップ付き）
            item {
                LocationSection(
                    isExpanded = uiState.isMapExpanded,
                    currentLocation = uiState.currentLocation,
                    selectedLocation = uiState.selectedLocation,
                    locationName = uiState.locationName,
                    onToggleMap = viewModel::toggleMap,
                    onLocationSelected = { latLng -> viewModel.setSelectedLocation(latLng) },
                    onLocationNameChange = viewModel::setLocationName,
                    onRequestPermission = { locationPermission.launchPermissionRequest() }
                )
            }

            // ④ メッセージ（オプション）
            item {
                OutlinedTextField(
                    value = uiState.message,
                    onValueChange = viewModel::setMessage,
                    label = { Text("一言メッセージ（任意）") },
                    placeholder = { Text("今夜飲もう！") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    maxLines = 3
                )
            }

            // ⑤ 飲みに行きたいボタン
            item {
                Button(
                    onClick = {
                        viewModel.sendInvite()
                        viewModel.searchRestaurants()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BeerAmber),
                    enabled = !uiState.isLoading
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("🍺 飲みに行きたい！", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // ⑥ おすすめ飲食店
            if (uiState.isLoadingRestaurants) {
                item {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = BeerAmber)
                            Spacer(Modifier.height(8.dp))
                            Text("周辺のお店を検索中...", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            if (uiState.restaurants.isNotEmpty()) {
                item {
                    Text(
                        "🍻 おすすめのお店",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                items(uiState.restaurants) { restaurant ->
                    RestaurantCard(restaurant = restaurant)
                }
            }

            uiState.restaurantError?.let { err ->
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            err,
                            modifier = Modifier.padding(16.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateTimeSection(
    dateTime: java.time.LocalDateTime,
    onDateTimeChanged: (java.time.LocalDateTime) -> Unit
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val dateFmt = DateTimeFormatter.ofPattern("M月d日(E)", java.util.Locale.JAPANESE)
    val timeFmt = DateTimeFormatter.ofPattern("HH:mm")

    Card(
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("📅 日時", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // 日付
                OutlinedButton(
                    onClick = { showDatePicker = true },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.CalendarToday, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(dateTime.format(dateFmt), fontWeight = FontWeight.SemiBold)
                }
                // 時間
                OutlinedButton(
                    onClick = { showTimePicker = true },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(dateTime.format(timeFmt), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }

    // 日付ピッカーダイアログ
    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = dateTime
                .atZone(java.time.ZoneId.of("Asia/Tokyo"))
                .toInstant()
                .toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { ms ->
                        val d = java.time.Instant.ofEpochMilli(ms)
                            .atZone(java.time.ZoneId.of("Asia/Tokyo"))
                            .toLocalDate()
                        onDateTimeChanged(dateTime.with(d))
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("キャンセル") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // 時間ピッカーダイアログ
    if (showTimePicker) {
        val timePickerState = rememberTimePickerState(
            initialHour = dateTime.hour,
            initialMinute = dateTime.minute,
            is24Hour = true
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("時間を選択") },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    onDateTimeChanged(
                        dateTime.withHour(timePickerState.hour)
                            .withMinute(timePickerState.minute)
                    )
                    showTimePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("キャンセル") }
            }
        )
    }
}

@Composable
fun ParticipantCountSection(count: Int, onCountChange: (Int) -> Unit) {
    Card(shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(2.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text("👥 募集人数", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                IconButton(
                    onClick = { onCountChange(count - 1) },
                    enabled = count > 2,
                    modifier = Modifier
                        .size(40.dp)
                        .background(
                            if (count > 2) BeerAmber.copy(alpha = 0.15f)
                            else Color.LightGray.copy(alpha = 0.2f),
                            CircleShape
                        )
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "減らす")
                }
                Text(
                    "$count 人",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                IconButton(
                    onClick = { onCountChange(count + 1) },
                    enabled = count < 20,
                    modifier = Modifier
                        .size(40.dp)
                        .background(BeerAmber.copy(alpha = 0.15f), CircleShape)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "増やす")
                }
                Spacer(Modifier.weight(1f))
                // クイック選択
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(2, 3, 4, 5).forEach { n ->
                        FilterChip(
                            selected = count == n,
                            onClick = { onCountChange(n) },
                            label = { Text("$n") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = BeerAmber,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LocationSection(
    isExpanded: Boolean,
    currentLocation: LatLng?,
    selectedLocation: LatLng?,
    locationName: String,
    onToggleMap: () -> Unit,
    onLocationSelected: (LatLng) -> Unit,
    onLocationNameChange: (String) -> Unit,
    onRequestPermission: () -> Unit
) {
    val displayLat = selectedLocation ?: currentLocation
    Card(shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(2.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("📍 場所（任意）", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onToggleMap) {
                    Icon(
                        if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.Map,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(if (isExpanded) "マップを閉じる" else "マップで選択")
                }
            }

            OutlinedTextField(
                value = locationName,
                onValueChange = onLocationNameChange,
                label = { Text("場所名（例：渋谷駅周辺）") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Place, contentDescription = null) }
            )

            // 簡易マップ
            AnimatedVisibility(visible = isExpanded) {
                Column {
                    Spacer(Modifier.height(12.dp))
                    if (displayLat != null) {
                        val cameraPositionState = rememberCameraPositionState {
                            position = CameraPosition.fromLatLngZoom(
                                selectedLocation ?: displayLat, 15f
                            )
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(240.dp)
                                .clip(RoundedCornerShape(12.dp))
                        ) {
                            GoogleMap(
                                modifier = Modifier.fillMaxSize(),
                                cameraPositionState = cameraPositionState,
                                onMapClick = { latLng ->
                                    onLocationSelected(latLng)
                                }
                            ) {
                                val pinLoc = selectedLocation ?: displayLat
                                Marker(
                                    state = MarkerState(position = pinLoc),
                                    title = if (selectedLocation != null) "選択した場所" else "現在地"
                                )
                            }
                            // ヒント
                            Surface(
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(8.dp),
                                shape = RoundedCornerShape(8.dp),
                                color = Color.Black.copy(alpha = 0.6f)
                            ) {
                                Text(
                                    "マップをタップして場所を選択",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                                )
                            }
                        }
                        if (selectedLocation != null) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "📌 選択済み: ${String.format("%.4f", selectedLocation.latitude)}, ${String.format("%.4f", selectedLocation.longitude)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .background(
                                    MaterialTheme.colorScheme.surfaceVariant,
                                    RoundedCornerShape(12.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.LocationOff, contentDescription = null)
                                Spacer(Modifier.height(8.dp))
                                Text("位置情報が必要です")
                                TextButton(onClick = onRequestPermission) {
                                    Text("許可する")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RestaurantCard(restaurant: Restaurant) {
    val context = LocalContext.current
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(3.dp)
    ) {
        Column {
            // 店舗写真
            if (restaurant.photo.isNotBlank()) {
                AsyncImage(
                    model = restaurant.photo,
                    contentDescription = restaurant.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    contentScale = ContentScale.Crop
                )
            }
            Column(Modifier.padding(12.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        restaurant.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = BeerAmber.copy(alpha = 0.15f)
                    ) {
                        Text(
                            restaurant.genre,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            color = BeerAmber
                        )
                    }
                }

                if (restaurant.catchCopy.isNotBlank()) {
                    Text(
                        restaurant.catchCopy,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (restaurant.budget.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.CurrencyYen,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                            Text(
                                restaurant.budget,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                        }
                    }
                    if (restaurant.access.isNotBlank()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                Icons.Default.Train,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                            Spacer(Modifier.width(2.dp))
                            Text(
                                restaurant.access,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))

                // アフィリエイトリンクボタン
                Button(
                    onClick = {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(restaurant.affiliateUrl))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BeerAmber)
                ) {
                    Icon(Icons.Default.OpenInBrowser, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("詳細・予約はこちら", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
