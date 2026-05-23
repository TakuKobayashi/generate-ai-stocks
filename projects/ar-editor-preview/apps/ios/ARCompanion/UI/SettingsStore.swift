// apps/ios/ARCompanion/UI/SettingsStore.swift
// UserDefaults (@AppStorage) で接続設定を永続化する。

import SwiftUI
import Combine

final class SettingsStore: ObservableObject {

    @AppStorage("serverUrl") var serverUrl: String = "ws://192.168.1.100:7880"
    @AppStorage("roomName")  var roomName:  String = "ar-preview"
    @AppStorage("token")     var token:     String = ""

    // トークンが空の場合は開発用トークンを自動生成するフラグ
    @AppStorage("useAutoToken") var useAutoToken: Bool = true
}
