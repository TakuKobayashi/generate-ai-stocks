package com.example.nomikai.data.api.models

import com.google.gson.annotations.SerializedName

// ===== User =====
data class RegisterUserRequest(
    val userId: String,
    val name: String,
    val fcmToken: String?
)

data class UpdateFcmTokenRequest(val fcmToken: String)

data class AddFriendRequest(val friendId: String)

data class UserResponse(
    val id: String,
    val name: String,
    val createdAt: Long
)

// ===== Invite =====
data class CreateInviteRequest(
    val creatorId: String,
    val dateTime: Long,
    val locationLat: Double?,
    val locationLng: Double?,
    val locationName: String?,
    val participantCount: Int,
    val message: String?
)

data class CreateInviteResponse(
    val success: Boolean,
    val inviteId: String,
    val notifiedCount: Int
)

data class DrinkingInvite(
    val id: String,
    val creatorId: String,
    val creatorName: String,
    val dateTime: Long,
    val locationLat: Double?,
    val locationLng: Double?,
    val locationName: String?,
    val participantCount: Int,
    val message: String?,
    val status: String,
    val createdAt: Long
)

// ===== Restaurant =====
data class Restaurant(
    val id: String,
    val name: String,
    val genre: String,
    val budget: String,
    val address: String,
    val lat: Double,
    val lng: Double,
    val photo: String,
    val catchCopy: String,
    val shopUrl: String,
    val affiliateUrl: String,
    val access: String,
    val open: String,
    val capacity: Int
)

data class RestaurantSearchResponse(
    val results: List<Restaurant>,
    val total: Int,
    val searchInfo: SearchInfo
)

data class SearchInfo(
    val lat: Double,
    val lng: Double,
    val range: Int,
    val radiusMeters: Int
)

// ===== Notification =====
data class AppNotification(
    val id: String,
    val userId: String,
    val inviteId: String?,
    val title: String,
    val body: String,
    val data: NotificationData?,
    val isRead: Int,
    val createdAt: Long
)

data class NotificationData(
    val type: String,
    val inviteId: String?,
    val creatorId: String?,
    val creatorName: String?
)

data class UnreadCountResponse(val count: Int)

data class ReadNotificationRequest(val userId: String)
