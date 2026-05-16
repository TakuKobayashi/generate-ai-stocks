package com.example.nomikai.data.repository

import com.example.nomikai.data.api.NomikaiApiService
import com.example.nomikai.data.api.models.ReadNotificationRequest
import com.example.nomikai.data.api.models.Restaurant
import com.example.nomikai.data.db.NotificationRecord
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

// ─────────────────────────────────────────────────────────────────────
//  RestaurantRepository - サーバー経由のみ（ローカルキャッシュなし）
// ─────────────────────────────────────────────────────────────────────
@Singleton
class RestaurantRepository @Inject constructor(
    private val apiService: NomikaiApiService
) {
    suspend fun getNearbyRestaurants(
        lat: Double,
        lng: Double,
        range: Int = 3,
        count: Int = 10,
        keyword: String? = null
    ): Result<List<Restaurant>> {
        return try {
            val response = apiService.getNearbyRestaurants(
                lat = lat, lng = lng, range = range, count = count, keyword = keyword
            )
            if (response.isSuccessful && response.body() != null)
                Result.Success(response.body()!!.results)
            else
                Result.Error("飲食店の取得に失敗しました: ${response.code()}")
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
//  NotificationRepository
//  - ローカル読み書きは NotificationRecord (ActiveRecord) に委譲
//  - サーバーとの既読同期のみ apiService を使用
// ─────────────────────────────────────────────────────────────────────
@Singleton
class NotificationRepository @Inject constructor(
    private val apiService: NomikaiApiService,
    private val userRepository: UserRepository
) {
    /**
     * ローカルDBの通知一覧を取得する。
     * 画面表示はローカルキャッシュ優先（オフラインでも閲覧可）。
     */
    suspend fun getNotifications(userId: String): Result<List<NotificationRecord>> {
        return try {
            // NotificationRecord.allForUser() — ActiveRecordクラスメソッド
            val records = NotificationRecord.allForUser(userId)
            Result.Success(records)
        } catch (e: Exception) {
            Result.Error("通知の取得に失敗しました: ${e.message}")
        }
    }

    /** Flow で通知一覧をリアルタイム監視する */
    fun observeNotifications(userId: String): Flow<List<NotificationRecord>> =
        NotificationRecord.observeForUser(userId)

    /** 未読件数をFlowで監視する */
    fun observeUnreadCount(userId: String): Flow<Int> =
        NotificationRecord.observeUnreadCount(userId)

    /**
     * サーバーから最新の通知を取得してローカルDBと同期する。
     * - APIから取得した通知を NotificationRecord.save() でキャッシュ
     * - 古い通知を pruneOld() で整理
     */
    suspend fun syncFromServer(userId: String): Result<Unit> {
        return try {
            val response = apiService.getNotifications(userId)
            if (response.isSuccessful) {
                val serverNotifs = response.body() ?: emptyList()
                // APIレスポンスをNotificationRecordに変換してActiveRecord#saveで保存
                serverNotifs.forEach { apiNotif ->
                    NotificationRecord(
                        id       = apiNotif.id,
                        userId   = apiNotif.userId,
                        inviteId = apiNotif.inviteId,
                        title    = apiNotif.title,
                        body     = apiNotif.body,
                        dataJson = apiNotif.data?.let {
                            com.google.gson.Gson().toJson(it)
                        },
                        isRead   = apiNotif.isRead,
                        createdAt = apiNotif.createdAt
                    ).save()   // ← ActiveRecord#save()
                }
                NotificationRecord.pruneOld(userId, keepCount = 50)
                Result.Success(Unit)
            } else {
                Result.Error("サーバー同期に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }

    /**
     * 通知を既読にする。
     * 1. ローカルDB を NotificationRecord#markRead() で即座に更新
     * 2. バックグラウンドでサーバーにも同期
     */
    suspend fun markAsRead(notificationId: String): Result<Unit> {
        val userId = userRepository.getCurrentUserId() ?: return Result.Error("ログインが必要です")
        return try {
            // ① ローカルDB即座更新（ActiveRecordインスタンスメソッド）
            val record = NotificationRecord.allForUser(userId)
                .firstOrNull { it.id == notificationId }
            record?.markRead()   // ← ActiveRecord#markRead()

            // ② サーバー同期
            apiService.markAsRead(notificationId, ReadNotificationRequest(userId))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error("既読処理に失敗しました: ${e.message}")
        }
    }

    /**
     * 全通知を既読にする。
     * 1. NotificationRecord.markAllRead() でローカルDB一括更新
     * 2. サーバーにも同期
     */
    suspend fun markAllAsRead(userId: String): Result<Unit> {
        return try {
            // ① ローカルDB一括更新（ActiveRecordクラスメソッド）
            NotificationRecord.markAllRead(userId)   // ← ActiveRecord.markAllRead()

            // ② サーバー同期
            apiService.markAllAsRead(userId)
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error("一括既読処理に失敗しました: ${e.message}")
        }
    }
}
