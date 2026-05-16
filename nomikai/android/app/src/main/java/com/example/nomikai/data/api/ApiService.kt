package com.example.nomikai.data.api

import com.example.nomikai.data.api.models.*
import retrofit2.Response
import retrofit2.http.*

interface NomikaiApiService {

    // ===== Users =====
    @POST("api/users/register")
    suspend fun registerUser(@Body request: RegisterUserRequest): Response<Map<String, Any>>

    @PUT("api/users/{userId}/fcm-token")
    suspend fun updateFcmToken(
        @Path("userId") userId: String,
        @Body request: UpdateFcmTokenRequest
    ): Response<Map<String, Any>>

    @POST("api/users/{userId}/friends")
    suspend fun addFriend(
        @Path("userId") userId: String,
        @Body request: AddFriendRequest
    ): Response<Map<String, Any>>

    @GET("api/users/{userId}/friends")
    suspend fun getFriends(@Path("userId") userId: String): Response<List<UserResponse>>

    @GET("api/users/{userId}")
    suspend fun getUser(@Path("userId") userId: String): Response<UserResponse>

    // ===== Invites =====
    @POST("api/invites")
    suspend fun createInvite(@Body request: CreateInviteRequest): Response<CreateInviteResponse>

    @GET("api/invites/received/{userId}")
    suspend fun getReceivedInvites(@Path("userId") userId: String): Response<List<DrinkingInvite>>

    @GET("api/invites/sent/{userId}")
    suspend fun getSentInvites(@Path("userId") userId: String): Response<List<DrinkingInvite>>

    @GET("api/invites/{inviteId}")
    suspend fun getInvite(@Path("inviteId") inviteId: String): Response<DrinkingInvite>

    // ===== Restaurants =====
    @GET("api/restaurants/nearby")
    suspend fun getNearbyRestaurants(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("range") range: Int = 3,
        @Query("count") count: Int = 10,
        @Query("keyword") keyword: String? = null
    ): Response<RestaurantSearchResponse>

    // ===== Notifications =====
    @GET("api/notifications/{userId}")
    suspend fun getNotifications(
        @Path("userId") userId: String,
        @Query("unread") unreadOnly: Boolean = false
    ): Response<List<AppNotification>>

    @GET("api/notifications/{userId}/unread-count")
    suspend fun getUnreadCount(@Path("userId") userId: String): Response<UnreadCountResponse>

    @PUT("api/notifications/{notificationId}/read")
    suspend fun markAsRead(
        @Path("notificationId") notificationId: String,
        @Body request: ReadNotificationRequest
    ): Response<Map<String, Any>>

    @PUT("api/notifications/{userId}/read-all")
    suspend fun markAllAsRead(@Path("userId") userId: String): Response<Map<String, Any>>
}
