package com.example.ais.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import kotlinx.coroutines.delay

/**
 * SYSTEM_ALERT_WINDOW を使ったオーバーレイ表示マネージャー。
 *
 * ## 設計
 * - WindowManager に ComposeView を追加して描画
 * - Lifecycle/SavedState/ViewModelStore を自前実装（Activityを必要としない）
 * - 表示時間: 900ms（フェードイン200ms + 表示500ms + フェードアウト200ms）
 * - 表示中にタップすると即座に非表示
 *
 * ## Android バージョン別の動作
 * - API 26+: TYPE_APPLICATION_OVERLAY を使用（必須）
 * - FLAG_NOT_FOCUSABLE: キーボード/タッチイベントを下のアプリに通す
 * - FLAG_NOT_TOUCH_MODAL: オーバーレイ外のタッチを通す
 * - FLAG_LAYOUT_IN_SCREEN: ステータスバー含む全領域に配置
 */
class GoalOverlayManager(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private var overlayView: ComposeView? = null
    private var isDismissing = false

    /**
     * オーバーレイを表示する。
     * すでに表示中なら何もしない。
     * @param goals 表示する目標テキストリスト（最大3件）
     */
    fun show(goals: List<String>) {
        if (overlayView != null) return
        if (goals.all { it.isBlank() }) return

        mainHandler.post {
            try {
                showInternal(goals)
            } catch (e: Exception) {
                // SYSTEM_ALERT_WINDOW 権限なし or WindowManager エラー
                overlayView = null
                isDismissing = false
            }
        }
    }

    private fun showInternal(goals: List<String>) {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            // API 26+ は TYPE_APPLICATION_OVERLAY 必須
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            // ステータスバーの下に表示
            y = getStatusBarHeight()
        }

        val lifecycleOwner = SimpleLifecycleOwner()
        lifecycleOwner.start()

        val view = ComposeView(context).apply {
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeViewModelStoreOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(lifecycleOwner)

            setContent {
                var visible by remember { mutableStateOf(false) }
                val alpha by animateFloatAsState(
                    targetValue = if (visible) 1f else 0f,
                    animationSpec = tween(durationMillis = 200),
                    label = "overlay_alpha"
                )

                LaunchedEffect(Unit) {
                    visible = true
                    delay(700)
                    visible = false
                    delay(200)
                    dismiss()
                }

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .fillMaxWidth()
                        .wrapContentHeight()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .alpha(alpha)
                        .shadow(
                            elevation = 12.dp,
                            shape = RoundedCornerShape(12.dp)
                        )
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xF2111111))
                        .clickable(
                            indication = null,
                            interactionSource = remember { MutableInteractionSource() }
                        ) { dismiss() }
                        .padding(horizontal = 24.dp, vertical = 20.dp)
                ) {
                    Text(
                        text = "TODAY",
                        color = Color(0xFF555555),
                        fontSize = 10.sp,
                        letterSpacing = 4.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    goals.filter { it.isNotBlank() }.forEach { goal ->
                        Text(
                            text = goal,
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Light,
                            textAlign = TextAlign.Center,
                            letterSpacing = 0.5.sp,
                            lineHeight = 26.sp,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }

        overlayView = view
        windowManager.addView(view, params)
    }

    fun dismiss() {
        if (isDismissing) return
        isDismissing = true
        mainHandler.post {
            try {
                overlayView?.let { windowManager.removeView(it) }
            } catch (_: Exception) {}
            overlayView = null
            isDismissing = false
        }
    }

    fun isShowing(): Boolean = overlayView != null

    private fun getStatusBarHeight(): Int {
        val resourceId = context.resources.getIdentifier(
            "status_bar_height", "dimen", "android"
        )
        return if (resourceId > 0) context.resources.getDimensionPixelSize(resourceId) else 0
    }
}

/**
 * ComposeView を Service/WindowManager 内で使うための最小限 LifecycleOwner 実装。
 * ViewModelStoreOwner と SavedStateRegistryOwner も兼ねる。
 */
private class SimpleLifecycleOwner :
    LifecycleOwner,
    ViewModelStoreOwner,
    SavedStateRegistryOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    private val savedStateRegistryController = SavedStateRegistryController.create(this)
    override val viewModelStore = ViewModelStore()
    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val savedStateRegistry: SavedStateRegistry
        get() = savedStateRegistryController.savedStateRegistry

    fun start() {
        savedStateRegistryController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
    }

    fun destroy() {
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        viewModelStore.clear()
    }
}
