package com.example.nomikai.ui.viewmodels

import android.annotation.SuppressLint
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.nomikai.data.api.models.CreateInviteResponse
import com.example.nomikai.data.api.models.Restaurant
import com.example.nomikai.data.db.UserRecord
import com.example.nomikai.data.repository.InviteRepository
import com.example.nomikai.data.repository.RestaurantRepository
import com.example.nomikai.data.repository.Result
import com.example.nomikai.data.repository.UserRepository
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.model.LatLng
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.ZoneId
import javax.inject.Inject

data class CreateInviteUiState(
    val isLoading: Boolean = false,
    val currentUser: UserRecord? = null,
    val participantCount: Int = 2,
    val dateTime: LocalDateTime = LocalDateTime.now().plusHours(2),
    // 場所: null = 現在地を自動使用
    val selectedLocation: LatLng? = null,
    val locationName: String = "",
    val message: String = "",
    // 現在地 (GPS)
    val currentLocation: LatLng? = null,
    val isMapExpanded: Boolean = false,
    // 飲食店
    val restaurants: List<Restaurant> = emptyList(),
    val isLoadingRestaurants: Boolean = false,
    val restaurantError: String? = null,
    // 送信結果
    val sendResult: CreateInviteResponse? = null,
    val error: String? = null
)

@HiltViewModel
class CreateInviteViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val inviteRepository: InviteRepository,
    private val restaurantRepository: RestaurantRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateInviteUiState())
    val uiState: StateFlow<CreateInviteUiState> = _uiState.asStateFlow()

    init {
        loadCurrentUser()
        fetchCurrentLocation()
    }

    /**
     * UserRecord.findCurrent() でローカルDBからカレントユーザーを取得。
     * ActiveRecordクラスメソッド経由でDAOにアクセスする。
     */
    private fun loadCurrentUser() {
        viewModelScope.launch {
            // ActiveRecordクラスメソッドで取得
            val user = UserRecord.findCurrent()
            _uiState.value = _uiState.value.copy(currentUser = user)
        }
    }

    @SuppressLint("MissingPermission")
    fun fetchCurrentLocation() {
        val fusedClient = LocationServices.getFusedLocationProviderClient(context)
        fusedClient.lastLocation.addOnSuccessListener { location ->
            location?.let {
                _uiState.value = _uiState.value.copy(
                    currentLocation = LatLng(it.latitude, it.longitude)
                )
            }
        }
    }

    fun setParticipantCount(count: Int) {
        _uiState.value = _uiState.value.copy(participantCount = count.coerceIn(2, 20))
    }

    fun setDateTime(dateTime: LocalDateTime) {
        _uiState.value = _uiState.value.copy(dateTime = dateTime)
    }

    fun setSelectedLocation(latLng: LatLng?, name: String = "") {
        _uiState.value = _uiState.value.copy(
            selectedLocation = latLng,
            locationName = name
        )
    }

    fun setLocationName(name: String) {
        _uiState.value = _uiState.value.copy(locationName = name)
    }

    fun setMessage(message: String) {
        _uiState.value = _uiState.value.copy(message = message)
    }

    fun toggleMap() {
        _uiState.value = _uiState.value.copy(isMapExpanded = !_uiState.value.isMapExpanded)
    }

    /** 周辺飲食店をホットペッパーAPIで検索する */
    fun searchRestaurants() {
        val state = _uiState.value
        val searchLat = state.selectedLocation?.latitude ?: state.currentLocation?.latitude ?: return
        val searchLng = state.selectedLocation?.longitude ?: state.currentLocation?.longitude ?: return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoadingRestaurants = true,
                restaurantError = null
            )
            when (val result = restaurantRepository.getNearbyRestaurants(
                lat = searchLat,
                lng = searchLng,
                range = 3,  // 1km以内
                count = 8
            )) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    restaurants = result.data,
                    isLoadingRestaurants = false
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    restaurantError = result.message,
                    isLoadingRestaurants = false
                )
            }
        }
    }

    /**
     * 飲みに行きたい！送信。
     * - InviteRepository.createInvite() → サーバーへPOST + FCM一斉送信
     * - 成功後に DrinkingInviteRecord.save() でローカルキャッシュ（Repository内）
     */
    fun sendInvite() {
        val state = _uiState.value
        if (state.currentUser == null) {
            _uiState.value = state.copy(error = "ユーザー情報が取得できませんでした。再起動してください。")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)

            val epochMs = state.dateTime
                .atZone(ZoneId.of("Asia/Tokyo"))
                .toInstant()
                .toEpochMilli()

            val useLat = state.selectedLocation?.latitude ?: state.currentLocation?.latitude
            val useLng = state.selectedLocation?.longitude ?: state.currentLocation?.longitude

            when (val result = inviteRepository.createInvite(
                dateTime         = epochMs,
                locationLat      = useLat,
                locationLng      = useLng,
                locationName     = state.locationName.ifBlank { null },
                participantCount = state.participantCount,
                message          = state.message.ifBlank { null }
            )) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    isLoading  = false,
                    sendResult = result.data
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error     = result.message
                )
            }
        }
    }

    fun clearSendResult() {
        _uiState.value = _uiState.value.copy(sendResult = null)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
