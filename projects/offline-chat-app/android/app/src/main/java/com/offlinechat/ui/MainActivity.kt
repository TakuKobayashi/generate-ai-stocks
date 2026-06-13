package com.offlinechat.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.offlinechat.data.models.ChatRoom
import com.offlinechat.ui.screens.*
import com.offlinechat.ui.theme.OfflineChatTheme
import com.offlinechat.ui.viewmodels.MainViewModel

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* 結果は無視してアプリ起動 */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestRequiredPermissions()

        setContent {
            OfflineChatTheme {
                AppNavigation()
            }
        }
    }

    private fun requestRequiredPermissions() {
        val perms = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            add(Manifest.permission.RECORD_AUDIO)
            add(Manifest.permission.CAMERA)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.NEARBY_WIFI_DEVICES)
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                add(Manifest.permission.BLUETOOTH_ADVERTISE)
                add(Manifest.permission.BLUETOOTH_CONNECT)
                add(Manifest.permission.BLUETOOTH_SCAN)
            } else {
                add(Manifest.permission.BLUETOOTH)
                add(Manifest.permission.BLUETOOTH_ADMIN)
            }
        }
        permissionLauncher.launch(perms.toTypedArray())
    }
}

@Composable
fun AppNavigation(vm: MainViewModel = viewModel()) {
    val nav = rememberNavController()

    NavHost(nav, startDestination = "home") {
        composable("home") {
            HomeScreen(
                viewModel = vm,
                onOpenChat = { userId ->
                    vm.openChatWith(userId)
                    nav.navigate("chat")
                },
                onChatList = { nav.navigate("chat_list") },
                onSettings = { nav.navigate("settings") }
            )
        }
        composable("chat_list") {
            ChatListScreen(
                viewModel = vm,
                onOpenRoom = { room: ChatRoom ->
                    vm.selectRoom(room)
                    nav.navigate("chat")
                },
                onBack = { nav.popBackStack() }
            )
        }
        composable("chat") {
            ChatScreen(
                viewModel = vm,
                onBack = { nav.popBackStack() }
            )
        }
        composable("settings") {
            SettingsScreen(
                viewModel = vm,
                onPastChats = { nav.navigate("past_chats") },
                onBack = { nav.popBackStack() }
            )
        }
        composable("past_chats") {
            PastChatsScreen(
                viewModel = vm,
                onBack = { nav.popBackStack() }
            )
        }
    }
}
