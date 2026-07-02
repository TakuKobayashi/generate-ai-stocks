import SwiftUI
import AVFoundation

struct ReceiveView: View {
    var onReceived: (Contact) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0

    var body: some View {
        NavigationStack {
            TabView(selection: $selectedTab) {
                QrReceiveTab(onReceived: handleReceived)
                    .tabItem { Label("QRコード", systemImage: "qrcode.viewfinder") }
                    .tag(0)

                NearbyReceiveTab(onReceived: handleReceived)
                    .tabItem { Label("近くのデバイス", systemImage: "wifi") }
                    .tag(1)

                NfcReceiveTab(onReceived: handleReceived)
                    .tabItem { Label("NFCタップ", systemImage: "wave.3.right") }
                    .tag(2)
            }
            .navigationTitle("名刺を受信")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }

    private func handleReceived(_ data: Data) {
        guard let payload = try? CardPayload.fromMessagePack(data) else { return }
        let contact = CardExchangeUtil.saveAsContact(payload)
        onReceived(contact)
    }
}

// MARK: - QR受信タブ

private struct QrReceiveTab: View {
    var onReceived: (Data) -> Void
    @State private var cameraPermission: AVAuthorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
    @State private var scanned = false

    var body: some View {
        Group {
            if cameraPermission == .authorized {
                ZStack {
                    QrScannerView { data in
                        guard !scanned else { return }
                        scanned = true
                        onReceived(data)
                    }
                    VStack {
                        Spacer()
                        Text("QRコードをカメラに向けてください")
                            .font(.callout)
                            .padding(8)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
                            .padding(.bottom, 32)
                    }
                }
            } else {
                VStack(spacing: 16) {
                    Text("カメラの使用を許可してください")
                    Button("設定を開く") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                .padding()
            }
        }
        .onAppear {
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    cameraPermission = granted ? .authorized : .denied
                }
            }
        }
    }
}

// MARK: - Nearby受信タブ

private struct NearbyReceiveTab: View {
    var onReceived: (Data) -> Void
    @StateObject private var manager = NearbyTransferManager(displayName: "Meishi Reader")

    var body: some View {
        List {
            Section {
                Text(manager.status)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            if manager.discoveredPeers.isEmpty {
                Section {
                    HStack {
                        Spacer()
                        VStack(spacing: 12) {
                            ProgressView()
                            Text("周囲のデバイスを検索中…")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding()
                }
            } else {
                Section("見つかったデバイス") {
                    ForEach(manager.discoveredPeers, id: \.0) { (peerID, name) in
                        Button {
                            manager.connect(to: peerID)
                        } label: {
                            HStack {
                                Image(systemName: "person.wave.2")
                                VStack(alignment: .leading) {
                                    Text(name.isEmpty ? "(名前未設定)" : name).font(.headline)
                                    Text("タップして接続").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .onAppear {
            manager.onPayloadReceived { data in onReceived(data) }
            manager.startBrowsing()
        }
        .onDisappear { manager.stopAll() }
    }
}

// MARK: - NFC受信タブ

private struct NfcReceiveTab: View {
    var onReceived: (Data) -> Void
    @StateObject private var nfcManager = NfcManager()
    @StateObject private var nearbyManager = NearbyTransferManager(displayName: "Meishi NFC Reader")
    @State private var phase: NFCPhase = .waiting

    enum NFCPhase { case waiting, readingToken, connecting, done }

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "wave.3.right")
                .font(.system(size: 72))
                .foregroundStyle(Color.accentColor)
                .padding(.top, 40)
            Text(statusText)
                .font(.body)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            if phase == .waiting {
                Button {
                    startNfcScan()
                } label: {
                    Label("NFCスキャン開始", systemImage: "wave.3.right")
                        .font(.headline)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 40)
            }
        }
        .padding()
        .onAppear {
            nearbyManager.onPayloadReceived { data in
                phase = .done
                onReceived(data)
            }
        }
        .onDisappear {
            nfcManager.stopReading()
            nearbyManager.stopAll()
        }
    }

    private var statusText: String {
        switch phase {
        case .waiting:     return "「NFCスキャン開始」を押して、相手の端末に近づけてください"
        case .readingToken:return "NFCを読み取り中…"
        case .connecting:  return nearbyManager.status
        case .done:        return "受信完了！"
        }
    }

    private func startNfcScan() {
        phase = .readingToken
        nfcManager.startReading { token in
            phase = .connecting
            nearbyManager.onPayloadReceived { data in
                phase = .done
                onReceived(data)
            }
            nearbyManager.startBrowsing()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                checkAndConnect(token: token)
            }
        }
    }

    private func checkAndConnect(token: String) {
        if let match = nearbyManager.discoveredPeers.first(where: { $0.1 == token || $0.0.displayName == token }) {
            nearbyManager.connect(to: match.0)
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                checkAndConnect(token: token)
            }
        }
    }
}
