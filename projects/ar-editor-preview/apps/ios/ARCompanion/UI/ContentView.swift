// apps/ios/ARCompanion/UI/ContentView.swift

import SwiftUI
import ARKit

// ─────────────────────────────────────────────────────────────────
// App エントリーポイント
// ─────────────────────────────────────────────────────────────────

@main
struct ARCompanionApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

// ─────────────────────────────────────────────────────────────────
// ViewModel
// ─────────────────────────────────────────────────────────────────

@MainActor
final class ARPreviewViewModel: ObservableObject {

    @Published var isConnected:   Bool    = false
    @Published var isConnecting:  Bool    = false
    @Published var errorMessage:  String? = nil
    @Published var frameCount:    UInt64  = 0
    @Published var planeCount:    Int     = 0
    @Published var rttMs:         Double  = -1

    @ObservedObject var settings = SettingsStore()

    private let arSession  = ARKitSession()
    private let streamer   = LiveKitStreamer()
    private var streamTask: Task<Void, Never>?

    // ── 接続 ─────────────────────────────────────────────────────

    func connect() {
        guard !isConnected, !isConnecting else { return }
        isConnecting  = true
        errorMessage  = nil

        streamTask = Task {
            do {
                let token = settings.token.isEmpty
                    ? JWTHelper.generateDevToken(
                        serverUrl  : settings.serverUrl,
                        room       : settings.roomName,
                        identity   : "ios-\(UIDevice.current.name)",
                        apiKey     : "devkey",
                        apiSecret  : "secret"
                      )
                    : settings.token

                try await streamer.connect(config: StreamerConfig(
                    serverUrl  : settings.serverUrl,
                    roomName   : settings.roomName,
                    identity   : "ios-\(UIDevice.current.name.replacing(" ", with: "-"))",
                    token      : token,
                ))

                isConnected  = true
                isConnecting = false

                arSession.start()

                // フレーム & プレーン 並列送信
                await withTaskGroup(of: Void.self) { group in
                    group.addTask { [weak self] in
                        guard let self else { return }
                        for await frame in self.arSession.frameStream {
                            self.streamer.sendFrame(frame)
                            self.frameCount += 1
                        }
                    }
                    group.addTask { [weak self] in
                        guard let self else { return }
                        for await planes in self.arSession.planeStream {
                            self.streamer.sendPlanes(planes)
                            self.planeCount = planes.count
                        }
                    }
                }
            } catch {
                isConnecting = false
                errorMessage = error.localizedDescription
            }
        }
    }

    // ── 切断 ─────────────────────────────────────────────────────

    func disconnect() {
        streamTask?.cancel()
        streamTask = nil
        arSession.pause()
        Task {
            await streamer.disconnect()
            isConnected = false
            rttMs       = -1
            frameCount  = 0
            planeCount  = 0
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// ContentView
// ─────────────────────────────────────────────────────────────────

struct ContentView: View {

    @StateObject private var vm       = ARPreviewViewModel()
    @StateObject private var settings = SettingsStore()
    @State private var tokenVisible   = false

    var body: some View {
        NavigationStack {
            Form {
                // ── ステータス ─────────────────────────────────
                Section {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(vm.isConnected ? Color.green : Color.orange)
                            .frame(width: 12, height: 12)
                        Text(vm.isConnected ? "接続中" : (vm.isConnecting ? "接続中..." : "未接続"))
                            .fontWeight(.semibold)
                    }
                    if vm.isConnected {
                        LabeledContent("フレーム数") { Text("\(vm.frameCount)") }
                        LabeledContent("プレーン数") { Text("\(vm.planeCount)") }
                        LabeledContent("RTT") {
                            Text(vm.rttMs >= 0 ? String(format: "%.1f ms", vm.rttMs) : "--")
                        }
                    }
                } header: { Text("接続状態") }

                // ── 設定 ───────────────────────────────────────
                Section("接続設定") {
                    LabeledContent("Server URL") {
                        TextField("ws://192.168.x.x:7880", text: $settings.serverUrl)
                            .keyboardType(.URL)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .disabled(vm.isConnected)
                    }
                    LabeledContent("Room Name") {
                        TextField("ar-preview", text: $settings.roomName)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .disabled(vm.isConnected)
                    }
                    Toggle("JWT を自動生成 (dev)", isOn: $settings.useAutoToken)
                        .disabled(vm.isConnected)
                    if !settings.useAutoToken {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("JWT Token").font(.caption).foregroundStyle(.secondary)
                            if tokenVisible {
                                TextField("eyJ...", text: $settings.token, axis: .vertical)
                                    .font(.system(size: 11, design: .monospaced))
                                    .lineLimit(3)
                            } else {
                                SecureField("eyJ...", text: $settings.token)
                            }
                            Button(tokenVisible ? "隠す" : "表示") { tokenVisible.toggle() }
                                .font(.caption)
                        }
                        .disabled(vm.isConnected)
                    }
                }

                // ── アクション ─────────────────────────────────
                Section {
                    Button {
                        vm.settings = settings
                        vm.connect()
                    } label: {
                        HStack {
                            if vm.isConnecting {
                                ProgressView().scaleEffect(0.8)
                                    .padding(.trailing, 4)
                            }
                            Text(vm.isConnecting ? "接続中..." : "接続")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(vm.isConnected || vm.isConnecting)

                    Button(role: .destructive) {
                        vm.disconnect()
                    } label: {
                        Text("切断").frame(maxWidth: .infinity)
                    }
                    .disabled(!vm.isConnected)
                }

                // ── エラー ─────────────────────────────────────
                if let err = vm.errorMessage {
                    Section {
                        Label(err, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }

                // ── セットアップ手順 ───────────────────────────
                if !vm.isConnected && !vm.isConnecting {
                    Section("セットアップ手順") {
                        ForEach([
                            "1. PC で docker compose up -d を実行",
                            "2. Unity Editor で Window > AR Editor Preview を開く",
                            "3. Server URL を PC の IP アドレスに設定",
                            "4. Unity で Play ▶ を押す",
                            "5. このアプリで「接続」をタップ",
                        ], id: \.self) { step in
                            Text(step).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("AR Editor Preview")
        }
    }
}
