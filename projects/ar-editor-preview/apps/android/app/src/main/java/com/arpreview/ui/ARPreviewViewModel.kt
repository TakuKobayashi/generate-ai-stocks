// apps/android/app/src/main/java/com/arpreview/ui/ARPreviewViewModel.kt

package com.arpreview.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.arpreview.ar.ARCoreSession
import com.arpreview.transport.LiveKitStreamer
import com.arpreview.transport.StreamerConfig
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

// ─────────────────────────────────────────────────────────────────
// UI 状態
// ─────────────────────────────────────────────────────────────────

data class ARPreviewUiState(
    val serverUrl:    String  = "ws://192.168.1.100:7880",
    val roomName:     String  = "ar-preview",
    val token:        String  = "",
    val isConnected:  Boolean = false,
    val isConnecting: Boolean = false,
    val rttMs:        Float   = -1f,
    val errorMessage: String? = null,
    val frameCount:   Long    = 0L,
    val planeCount:   Int     = 0,
)

class ARPreviewViewModel(app: Application) : AndroidViewModel(app) {

    private val _uiState = MutableStateFlow(ARPreviewUiState())
    val uiState: StateFlow<ARPreviewUiState> = _uiState.asStateFlow()

    private val settingsStore = SettingsStore(app)
    private val arSession     = ARCoreSession(app)
    private val streamer      = LiveKitStreamer(app)

    private var arJob: Job? = null

    init {
        // 保存済み設定をロード
        viewModelScope.launch {
            settingsStore.settings.collect { saved ->
                _uiState.update {
                    it.copy(
                        serverUrl = saved.serverUrl,
                        roomName  = saved.roomName,
                        token     = saved.token,
                    )
                }
            }
        }
    }

    // ─── 設定変更 ────────────────────────────────────────────────

    fun onServerUrlChanged(v: String) = _uiState.update { it.copy(serverUrl = v) }
    fun onRoomNameChanged(v: String)  = _uiState.update { it.copy(roomName  = v) }
    fun onTokenChanged(v: String)     = _uiState.update { it.copy(token     = v) }

    // ─── 接続 ────────────────────────────────────────────────────

    fun connect() {
        val state = _uiState.value
        _uiState.update { it.copy(isConnecting = true, errorMessage = null) }

        // 設定を保存
        viewModelScope.launch {
            settingsStore.save(ConnectionSettings(state.serverUrl, state.roomName, state.token))
        }

        viewModelScope.launch {
            // ARCore 初期化
            if (!arSession.create()) {
                _uiState.update { it.copy(isConnecting = false, errorMessage = "ARCore を初期化できませんでした") }
                return@launch
            }
            arSession.resume()

            // LiveKit 接続
            val result = streamer.connect(
                StreamerConfig(
                    serverUrl = state.serverUrl,
                    roomName  = state.roomName,
                    identity  = "android-${android.os.Build.MODEL.replace(" ", "-")}",
                    token     = state.token,
                )
            )

            result.onFailure { e ->
                _uiState.update { it.copy(isConnecting = false, errorMessage = e.message) }
                arSession.destroy()
                return@launch
            }

            _uiState.update { it.copy(isConnecting = false, isConnected = true) }

            // AR データ送信ループ
            arJob = launch {
                var frameCount = 0L
                launch {
                    arSession.frameFlow().collect { frame ->
                        streamer.sendFrame(frame)
                        frameCount++
                        if (frameCount % 30 == 0L) {
                            _uiState.update { it.copy(frameCount = frameCount, rttMs = streamer.rttMs) }
                        }
                    }
                }
                launch {
                    arSession.planeUpdateFlow().collect { planes ->
                        streamer.sendPlanes(planes)
                        _uiState.update { it.copy(planeCount = planes.size) }
                    }
                }
            }
        }
    }

    // ─── 切断 ────────────────────────────────────────────────────

    fun disconnect() {
        arJob?.cancel()
        arJob = null
        viewModelScope.launch {
            streamer.disconnect()
            arSession.destroy()
            _uiState.update {
                it.copy(isConnected = false, rttMs = -1f, frameCount = 0L, planeCount = 0)
            }
        }
    }

    fun onResume()  = runCatching { arSession.resume() }
    fun onPause()   = runCatching { arSession.pause()  }

    override fun onCleared() {
        super.onCleared()
        disconnect()
        streamer.destroy()
    }
}
