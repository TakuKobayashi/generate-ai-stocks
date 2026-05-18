package com.example.nomikai

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.nomikai.data.repository.UserRepository
import com.example.nomikai.ui.screens.CreateInviteScreen
import com.example.nomikai.ui.screens.NotificationsScreen
import com.example.nomikai.ui.screens.SetupScreen
import com.example.nomikai.ui.theme.NomikaiTheme
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var userRepository: UserRepository

    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* granted */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Android 13+ 通知許可リクエスト
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // FCMトークン取得・DB更新
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            activityScope.launch {
                userRepository.updateFcmToken(token)
            }
        }

        // Room (UserRecord.findCurrent) でログイン済みか確認
        val isRegistered = runBlocking { userRepository.getCurrentUserId() != null }

        // 通知タップからの起動かどうか検出
        val launchInviteId =
            intent?.getStringExtra(NomikaiFirebaseMessagingService.EXTRA_INVITE_ID)

        setContent {
            NomikaiTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    NavHost(
                        navController = navController,
                        startDestination = if (isRegistered) "home" else "setup"
                    ) {
                        composable("setup") {
                            SetupScreen(
                                onSetupComplete = {
                                    navController.navigate("home") {
                                        popUpTo("setup") { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("home") {
                            // 通知タップ起動時は即座に通知一覧へ遷移
                            LaunchedEffect(launchInviteId) {
                                if (launchInviteId != null) {
                                    navController.navigate("notifications")
                                }
                            }
                            CreateInviteScreen(
                                onNavigateToNotifications = {
                                    navController.navigate("notifications")
                                }
                            )
                        }
                        composable("notifications") {
                            NotificationsScreen(
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        activityScope.coroutineContext[SupervisorJob]?.cancel()
    }
}
