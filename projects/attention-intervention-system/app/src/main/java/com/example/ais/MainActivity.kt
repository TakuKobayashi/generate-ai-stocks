package com.example.ais

import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ais.data.entity.TriggerType
import com.example.ais.data.prefs.isOnboardingDone
import com.example.ais.data.prefs.observeMode
import com.example.ais.data.prefs.setOnboardingDone
import com.example.ais.domain.InterventionMode
import com.example.ais.notification.GoalNotificationManager
import com.example.ais.ui.screen.GoalSetupScreen
import com.example.ais.ui.screen.PermissionGuideScreen
import com.example.ais.ui.theme.AISTheme
import com.example.ais.ui.viewmodel.GoalViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var prefs: DataStore<Preferences>
    @Inject lateinit var notificationManager: GoalNotificationManager

    private val viewModel: GoalViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        setContent {
            AISTheme {
                val scope = rememberCoroutineScope()
                var screen by remember { mutableStateOf<Screen>(Screen.Loading) }

                // 初回起動チェック
                LaunchedEffect(Unit) {
                    screen = if (prefs.isOnboardingDone()) Screen.Goals else Screen.Permission
                }

                // モード変更を監視 → ForegroundService の起動/停止を制御
                val mode by prefs.observeMode().collectAsStateWithLifecycle(
                    initialValue = InterventionMode.NORMAL
                )
                LaunchedEffect(mode) {
                    (applicationContext as AISApplication).updateInterventionService(mode)
                }

                when (screen) {
                    Screen.Loading -> { /* 一瞬で切り替わる */ }

                    Screen.Permission -> {
                        PermissionGuideScreen(
                            selectedMode = mode,
                            onComplete = {
                                scope.launch {
                                    prefs.setOnboardingDone()
                                    notificationManager.scheduleDailyRefresh()
                                    notificationManager.postGoalNotification()
                                    screen = Screen.Goals
                                }
                            }
                        )
                    }

                    Screen.Goals -> {
                        GoalSetupScreen(
                            viewModel = viewModel,
                            onSaved = {
                                scope.launch {
                                    notificationManager.postGoalNotification()
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Normal/Hard モードのアプリ起動ログ
        kotlinx.coroutines.MainScope().launch {
            if (viewModel.canInterveneNow()) {
                viewModel.recordIntervention(TriggerType.APP_LAUNCH)
            }
        }
    }
}

private sealed class Screen {
    object Loading : Screen()
    object Permission : Screen()
    object Goals : Screen()
}
