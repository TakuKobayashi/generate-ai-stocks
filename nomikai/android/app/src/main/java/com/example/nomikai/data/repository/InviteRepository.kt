package com.example.nomikai.data.repository

import com.example.nomikai.data.api.NomikaiApiService
import com.example.nomikai.data.api.models.CreateInviteRequest
import com.example.nomikai.data.api.models.CreateInviteResponse
import com.example.nomikai.data.db.DrinkingInviteRecord
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InviteRepository @Inject constructor(
    private val apiService: NomikaiApiService,
    private val userRepository: UserRepository
) {
    /**
     * 飲み会誘いを作成する。
     * 1. サーバーに POST してFCM通知を送信
     * 2. レスポンスの inviteId で DrinkingInviteRecord を生成して save()
     */
    suspend fun createInvite(
        dateTime: Long,
        locationLat: Double?,
        locationLng: Double?,
        locationName: String?,
        participantCount: Int,
        message: String?
    ): Result<CreateInviteResponse> {
        val currentUser = userRepository.getCurrentUser()
            ?: return Result.Error("ログインが必要です")

        return try {
            val response = apiService.createInvite(
                CreateInviteRequest(
                    creatorId        = currentUser.id,
                    dateTime         = dateTime,
                    locationLat      = locationLat,
                    locationLng      = locationLng,
                    locationName     = locationName,
                    participantCount = participantCount,
                    message          = message
                )
            )
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                // ローカルDBにキャッシュ（ActiveRecord#save）
                DrinkingInviteRecord(
                    id               = body.inviteId,
                    creatorId        = currentUser.id,
                    creatorName      = currentUser.name,
                    direction        = DrinkingInviteRecord.DIRECTION_SENT,
                    userId           = currentUser.id,
                    dateTime         = dateTime,
                    locationLat      = locationLat,
                    locationLng      = locationLng,
                    locationName     = locationName,
                    participantCount = participantCount,
                    message          = message
                ).save()   // ← ActiveRecord#save()
                Result.Success(body)
            } else {
                Result.Error("誘いの送信に失敗しました: ${response.code()}")
            }
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }

    /**
     * 受け取った誘いをFlowで監視する（ローカルDBキャッシュ）。
     * サーバー同期は syncReceived() で別途呼び出す。
     */
    fun observeReceivedInvites(userId: String): Flow<List<DrinkingInviteRecord>> =
        DrinkingInviteRecord.observeReceived(userId)   // ← ActiveRecordクラスメソッド

    /** 送った誘いをFlowで監視する */
    fun observeSentInvites(userId: String): Flow<List<DrinkingInviteRecord>> =
        DrinkingInviteRecord.observeSent(userId)

    /**
     * サーバーから受け取った誘いを取得してローカルDBと同期する。
     * - DrinkingInviteRecord.fromApiResponse() で変換
     * - ActiveRecord#save() でキャッシュ保存
     */
    suspend fun syncReceived(userId: String): Result<Unit> {
        return try {
            val response = apiService.getReceivedInvites(userId)
            if (response.isSuccessful) {
                val invites = response.body() ?: emptyList()
                invites.forEach { apiInvite ->
                    // ファクトリメソッドで変換→save
                    DrinkingInviteRecord.fromApiResponse(apiInvite, userId).save()
                }
                Result.Success(Unit)
            } else {
                Result.Error("誘い一覧の同期に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }

    /**
     * IDで誘い詳細を取得する（ローカルキャッシュ優先・なければサーバーフォールバック）
     */
    suspend fun getInvite(inviteId: String): Result<DrinkingInviteRecord> {
        // ① ローカルDBを確認（ActiveRecordクラスメソッド）
        val local = DrinkingInviteRecord.find(inviteId)
        if (local != null) return Result.Success(local)

        // ② なければサーバーから取得してキャッシュ
        return try {
            val currentUser = userRepository.getCurrentUser()
                ?: return Result.Error("ログインが必要です")
            val response = apiService.getInvite(inviteId)
            if (response.isSuccessful && response.body() != null) {
                val record = DrinkingInviteRecord.fromApiResponse(response.body()!!, currentUser.id)
                record.save()   // ← ActiveRecord#save()
                Result.Success(record)
            } else {
                Result.Error("誘い情報の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error("ネットワークエラー: ${e.message}")
        }
    }
}
