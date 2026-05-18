package com.example.nomikai.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.nomikai.data.db.NotificationRecord
import com.example.nomikai.data.repository.NotificationRepository
import com.example.nomikai.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationsUiState(
    val isLoading: Boolean = false,
    val notifications: List<NotificationRecord> = emptyList(),
    val unreadCount: Int = 0,
    val error: String? = null
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val notificationRepository: NotificationRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    private val _error = MutableStateFlow<String?>(null)

    // NotificationRecord.observeForUser() のFlowをそのまま公開
    // （DB変更が即座に画面に反映される）
    val uiState: StateFlow<NotificationsUiState> = userRepository.currentUserFlow
        .flatMapLatest { user ->
            if (user == null) {
                flowOf(NotificationsUiState())
            } else {
                // ActiveRecordクラスメソッドのFlowと未読数Flowを結合
                combine(
                    NotificationRecord.observeForUser(user.id),
                    NotificationRecord.observeUnreadCount(user.id),
                    _isLoading,
                    _error
                ) { notifications, unreadCount, isLoading, error ->
                    NotificationsUiState(
                        isLoading     = isLoading,
                        notifications = notifications,
                        unreadCount   = unreadCount,
                        error         = error
                    )
                }
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = NotificationsUiState(isLoading = true)
        )

    init {
        syncFromServer()
    }

    /** サーバーから最新通知を取得してDBと同期する */
    fun syncFromServer() {
        viewModelScope.launch {
            val userId = userRepository.getCurrentUserId() ?: return@launch
            _isLoading.value = true
            notificationRepository.syncFromServer(userId)
            _isLoading.value = false
        }
    }

    /**
     * 指定した通知を既読にする。
     * NotificationRecord#markRead() でローカルDB即座更新 → Flowが自動で再emitされ画面更新。
     */
    fun markAsRead(notificationId: String) {
        viewModelScope.launch {
            notificationRepository.markAsRead(notificationId)
        }
    }

    /**
     * 全通知を既読にする。
     * NotificationRecord.markAllRead() でローカルDB一括更新。
     */
    fun markAllAsRead() {
        viewModelScope.launch {
            val userId = userRepository.getCurrentUserId() ?: return@launch
            notificationRepository.markAllAsRead(userId)
        }
    }
}
