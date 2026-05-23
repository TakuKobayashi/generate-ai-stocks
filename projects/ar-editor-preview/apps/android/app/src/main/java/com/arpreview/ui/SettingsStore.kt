// apps/android/app/src/main/java/com/arpreview/ui/SettingsStore.kt
// DataStore で接続設定を永続化する。

package com.arpreview.ui

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "ar_preview_settings")

data class ConnectionSettings(
    val serverUrl: String = "ws://192.168.1.100:7880",
    val roomName:  String = "ar-preview",
    val token:     String = "",
)

class SettingsStore(private val context: Context) {

    companion object {
        private val KEY_SERVER_URL = stringPreferencesKey("server_url")
        private val KEY_ROOM_NAME  = stringPreferencesKey("room_name")
        private val KEY_TOKEN      = stringPreferencesKey("token")
    }

    val settings: Flow<ConnectionSettings> = context.dataStore.data.map { prefs ->
        ConnectionSettings(
            serverUrl = prefs[KEY_SERVER_URL] ?: "ws://192.168.1.100:7880",
            roomName  = prefs[KEY_ROOM_NAME]  ?: "ar-preview",
            token     = prefs[KEY_TOKEN]      ?: "",
        )
    }

    suspend fun save(settings: ConnectionSettings) {
        context.dataStore.edit { prefs ->
            prefs[KEY_SERVER_URL] = settings.serverUrl
            prefs[KEY_ROOM_NAME]  = settings.roomName
            prefs[KEY_TOKEN]      = settings.token
        }
    }
}
