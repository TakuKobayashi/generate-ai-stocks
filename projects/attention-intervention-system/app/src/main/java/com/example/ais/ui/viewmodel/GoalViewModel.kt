package com.example.ais.ui.viewmodel

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.ais.data.dao.GoalDao
import com.example.ais.data.dao.InterventionLogDao
import com.example.ais.data.entity.Goal
import com.example.ais.data.entity.GoalValidationResult
import com.example.ais.data.entity.InterventionLog
import com.example.ais.data.entity.TriggerType
import com.example.ais.data.prefs.markEditedToday
import com.example.ais.data.prefs.observeCanEdit
import com.example.ais.data.prefs.observeMode
import com.example.ais.data.prefs.setMode
import com.example.ais.domain.InterventionMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GoalViewModel @Inject constructor(
    private val goalDao: GoalDao,
    private val logDao: InterventionLogDao,
    private val prefs: DataStore<Preferences>
) : ViewModel() {

    // ── UI State ──────────────────────────────────────────

    data class UiState(
        val goals: List<Goal> = emptyList(),
        val draftTexts: List<String> = listOf("", "", ""),
        val mode: InterventionMode = InterventionMode.NORMAL,
        val canEdit: Boolean = true,
        val isSaving: Boolean = false,
        val saveSuccess: Boolean = false,
        val errorMessage: String? = null
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState

    // Overlay表示用（テキストのみ）
    val activeGoalTexts: StateFlow<List<String>> = goalDao.observeActiveGoals()
        .map { goals -> goals.map { it.text } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch {
            combine(
                goalDao.observeActiveGoals(),
                prefs.observeMode(),
                prefs.observeCanEdit()
            ) { goals, mode, canEdit ->
                Triple(goals, mode, canEdit)
            }.collect { (goals, mode, canEdit) ->
                val drafts = MutableList(3) { "" }
                goals.forEach { g ->
                    if (g.displayOrder in 0..2) drafts[g.displayOrder] = g.text
                }
                _uiState.update { state ->
                    state.copy(
                        goals = goals,
                        draftTexts = drafts,
                        mode = mode,
                        canEdit = canEdit
                    )
                }
            }
        }
    }

    // ── Intent handlers ───────────────────────────────────

    fun updateDraft(index: Int, text: String) {
        if (!_uiState.value.canEdit) return
        val updated = _uiState.value.draftTexts.toMutableList()
        updated[index] = text
        _uiState.update { it.copy(draftTexts = updated, errorMessage = null) }
    }

    fun saveGoals() = viewModelScope.launch {
        if (!_uiState.value.canEdit) return@launch
        _uiState.update { it.copy(isSaving = true, errorMessage = null) }

        val drafts = _uiState.value.draftTexts

        // バリデーション（空でないものだけチェック）
        val error = drafts
            .filter { it.isNotBlank() }
            .map { Goal.new(it, 0).validate() }
            .firstOrNull { it != GoalValidationResult.OK }

        if (error != null) {
            _uiState.update { it.copy(isSaving = false, errorMessage = error.message()) }
            return@launch
        }

        if (drafts.all { it.isBlank() }) {
            _uiState.update {
                it.copy(isSaving = false, errorMessage = "目標を1つ以上入力してください")
            }
            return@launch
        }

        goalDao.deactivateByDate(Goal.todayKey())
        val newGoals = drafts
            .mapIndexed { i, text -> Goal.new(text, i) }
            .filter { !it.isBlank() }
        goalDao.upsertAll(newGoals)

        prefs.markEditedToday()
        logDao.insert(InterventionLog.appLaunch())
        _uiState.update { it.copy(isSaving = false, saveSuccess = true) }
    }

    fun consumeSaveSuccess() {
        _uiState.update { it.copy(saveSuccess = false) }
    }

    fun setMode(mode: InterventionMode) = viewModelScope.launch {
        prefs.setMode(mode)
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    // ── 介入可否判定 ──────────────────────────────────────

    /**
     * APP_LAUNCH ログ記録前に呼ぶ。
     * SCREEN_ON 専用カウンターとは分けて管理。
     */
    suspend fun canInterveneNow(): Boolean {
        val lastScreenOn = logDao.getLatestScreenOn()
        val todayCount = logDao.countScreenOnByDate(Goal.todayKey())
        return InterventionLog.canInterveneNow(lastScreenOn, todayCount)
    }

    suspend fun recordIntervention(type: TriggerType) {
        logDao.insert(InterventionLog(triggerType = type))
    }
}
