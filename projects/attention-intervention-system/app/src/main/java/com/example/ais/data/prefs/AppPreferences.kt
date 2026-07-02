package com.example.ais.data.prefs

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.example.ais.data.entity.Goal
import com.example.ais.domain.InterventionMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

object AppPrefsKeys {
    val MODE = stringPreferencesKey("intervention_mode")
    val LAST_EDIT_DATE = stringPreferencesKey("last_edit_date")
    val ONBOARDING_DONE = booleanPreferencesKey("onboarding_done")
    val NOTIFICATION_POSTED_DATE = stringPreferencesKey("notification_posted_date")
}

// ── Mode ──────────────────────────────────────────────────

suspend fun DataStore<Preferences>.getMode(): InterventionMode {
    return data.first()[AppPrefsKeys.MODE]
        ?.let { runCatching { InterventionMode.valueOf(it) }.getOrNull() }
        ?: InterventionMode.NORMAL
}

fun DataStore<Preferences>.observeMode(): Flow<InterventionMode> =
    data.map { prefs ->
        prefs[AppPrefsKeys.MODE]
            ?.let { runCatching { InterventionMode.valueOf(it) }.getOrNull() }
            ?: InterventionMode.NORMAL
    }

suspend fun DataStore<Preferences>.setMode(mode: InterventionMode) {
    edit { it[AppPrefsKeys.MODE] = mode.name }
}

// ── Edit limit ────────────────────────────────────────────

suspend fun DataStore<Preferences>.canEditToday(): Boolean {
    val last = data.first()[AppPrefsKeys.LAST_EDIT_DATE] ?: return true
    return last != Goal.todayKey()
}

fun DataStore<Preferences>.observeCanEdit(): Flow<Boolean> =
    data.map { prefs ->
        val last = prefs[AppPrefsKeys.LAST_EDIT_DATE] ?: return@map true
        last != Goal.todayKey()
    }

suspend fun DataStore<Preferences>.markEditedToday() {
    edit { it[AppPrefsKeys.LAST_EDIT_DATE] = Goal.todayKey() }
}

// ── Onboarding ────────────────────────────────────────────

suspend fun DataStore<Preferences>.isOnboardingDone(): Boolean =
    data.first()[AppPrefsKeys.ONBOARDING_DONE] ?: false

suspend fun DataStore<Preferences>.setOnboardingDone() {
    edit { it[AppPrefsKeys.ONBOARDING_DONE] = true }
}

// ── Notification ──────────────────────────────────────────

suspend fun DataStore<Preferences>.getNotificationPostedDate(): String? =
    data.first()[AppPrefsKeys.NOTIFICATION_POSTED_DATE]

suspend fun DataStore<Preferences>.setNotificationPostedDate(dateKey: String) {
    edit { it[AppPrefsKeys.NOTIFICATION_POSTED_DATE] = dateKey }
}
