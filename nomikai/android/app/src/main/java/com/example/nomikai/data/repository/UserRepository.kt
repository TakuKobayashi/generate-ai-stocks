package com.example.nomikai.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.nomikai.data.api.NomikaiApiService
import com.example.nomikai.data.api.models.AddFriendRequest
import com.example.nomikai.data.api.models.RegisterUserRequest
import com.example.nomikai.data.api.models.UpdateFcmTokenRequest
import com.example.nomikai.data.api.models.UserResponse
import com.example.nomikai.data.db.UserRecord
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "nomikai_prefs")

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}

@Singleton
class UserRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apiService: NomikaiApiService
) {
    // FCMトークンのみDataStoreに保持（ユーザー本体はUserRecord ARで管理）
    private val FCM_TOKEN_KEY = stringPreferencesKey("fcm_token")

    val currentUserFlow: Flow<UserRecord?> = UserRecord.observeCurrent()

    suspend fun getCurrentUser(): UserRecord? = UserRecord.findCurrent()

    suspend fun getCurrentUserId(): String? = getCurrentUser()?.id

    suspend fun getCurrentUserName(): String? = getCurrentUser()?.name

    /**
     * ユーザー登録（初回起動時）。
     * 1. UserRecord を生成してローカルDBに保存（ActiveRecord#save）
     * 2. サーバーに登録リクエスト送信
     */
    suspend fun registerUser(name: String, fcmToken: String?): Result<String> {
        return try {
            // 既存IDがあれば再利用、なければ新規UUID
            val existingUser = UserRecord.findCurrent()
            val userId = existingUser?.id ?: UUID.randomUUID().toString()

            // ① ローカルDBに保存（ActiveRecord）
            val userRecord = UserRecord(
                id = userId,
                name = name,
                fcmToken = fcmToken,
                isCurrent = 1
            )
            UserRecord.setCurrent(userRecord)   // 旧currentフラグをリセットしてから保存

            // ② FCMトークンをDataStoreにも保存
            fcmToken?.let {
                context.dataStore.edit { prefs -> prefs[FCM_TOKEN_KEY] = it }
            }

            // ③ サーバーに登録
            val response = apiService.registerUser(
                RegisterUserRequest(userId = userId, name = name, fcmToken = fcmToken)
            )
            if (response.isSuccessful) {
                Result.Success(userId)
            } else {
                Result.Error("サーバー登録に失敗しました: ${response.code()}")
            }
        } catch (e: Exception) {
            Result.Error("エラー: ${e.message}")
        }
    }

    /**
     * FCMトークン更新。
     * UserRecord#updateFcmToken でローカルDB更新し、サーバーにも反映する。
     */
    suspend fun updateFcmToken(token: String) {
        context.dataStore.edit { it[FCM_TOKEN_KEY] = token }
        // ActiveRecord インスタンスメソッドでDB更新
        getCurrentUser()?.updateFcmToken(token)

        val userId = getCurrentUserId() ?: return
        try {
            apiService.updateFcmToken(userId, UpdateFcmTokenRequest(token))
        } catch (_: Exception) { /* サイレント失敗、次回起動時にリトライ */ }
    }

    /** フレンド追加（サーバー側のみ、ローカルキャッシュは今後拡張） */
    suspend fun addFriend(friendId: String): Result<Unit> {
        val userId = getCurrentUserId() ?: return Result.Error("ログインが必要です")
        return try {
            val response = apiService.addFriend(userId, AddFriendRequest(friendId))
            if (response.isSuccessful) Result.Success(Unit)
            else Result.Error("フレンド追加に失敗しました")
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }

    /** フレンド一覧取得 */
    suspend fun getFriends(): Result<List<UserResponse>> {
        val userId = getCurrentUserId() ?: return Result.Error("ログインが必要です")
        return try {
            val response = apiService.getFriends(userId)
            if (response.isSuccessful) Result.Success(response.body() ?: emptyList())
            else Result.Error("フレンド一覧の取得に失敗しました")
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }
}
