import SwiftUI

struct SendView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0

    private let profile = Profile.current()
    private let payloadData: Data = {
        let p = Profile.current()
        return CardExchangeUtil.buildPayload(profile: p).toMessagePack()
    }()

    var body: some View {
        NavigationStack {
            TabView(selection: $selectedTab) {
                QrSendTab(payloadData: payloadData)
                    .tabItem { Label("QRコード", systemImage: "qrcode") }
                    .tag(0)

                NearbySendTab(profile: profile, payloadData: payloadData)
                    .tabItem { Label("近くのデバイス", systemImage: "wifi") }
                    .tag(1)

                NfcSendTab(profile: profile, payloadData: payloadData)
                    .tabItem { Label("NFCタップ", systemImage: "wave.3.right") }
                    .tag(2)
            }
            .navigationTitle("名刺を送信")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }
}

// MARK: - QR送信タブ

private struct QrSendTab: View {
    let payloadData: Data
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let img = QrCodeUtil.generate(data: payloadData, size: 280) {
                    Image(uiImage: img)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 280, height: 280)
                }
                Text("相手に「受信」→「QRコード」タブでスキャンしてもらってください。アカウント登録は不要です。")
                    .font(.callout)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }
            .padding(.top, 32)
        }
    }
}

// MARK: - Nearby送信タブ

private struct NearbySendTab: View {
    let profile: Profile
    let payloadData: Data
    @StateObject private var manager: NearbyTransferManager

    init(profile: Profile, payloadData: Data) {
        self.profile = profile
        self.payloadData = payloadData
        _manager = StateObject(wrappedValue: NearbyTransferManager(
            displayName: profile.name.isEmpty ? "Meishi User" : profile.name
        ))
    }

    var body: some View {
        VStack(spacing: 24) {
            ProgressView().padding(.top, 40)
            Text(manager.status)
                .font(.body)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Text("相手の「受信」→「近くのデバイス」タブから見つけて接続してもらってください。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .onAppear {
            manager.setOutgoingData(payloadData)
            manager.startAdvertising()
        }
        .onDisappear { manager.stopAll() }
    }
}

// MARK: - NFC送信タブ (Advertise + HCE token)

private struct NfcSendTab: View {
    let profile: Profile
    let payloadData: Data
    @StateObject private var manager: NearbyTransferManager

    // iOSはHCEをサポートしないため、NFC送信側では簡易的にランダムセッショントークンを
    // Nearby の displayName として広告し、受信側がNFCで読んだトークンと照合するAndroid側の
    // フローをiOS同士の場合は「受信側がQRかNearbyで合わせて接続する」運用にしている。
    // ここでは画面上にセッショントークンを表示し、相手に手動またはNearbyで入力させるシンプルな実装とする。
    private let sessionToken: String

    init(profile: Profile, payloadData: Data) {
        self.profile = profile
        self.payloadData = payloadData
        let token = String(format: "%06d", Int.random(in: 0..<1000000))
        sessionToken = token
        _manager = StateObject(wrappedValue: NearbyTransferManager(displayName: token))
    }

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "wave.3.right")
                .font(.system(size: 72))
                .foregroundStyle(Color.accentColor)
                .padding(.top, 40)
            Text("セッションコード")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(sessionToken)
                .font(.system(size: 48, weight: .bold, design: .monospaced))
            Text(manager.status)
                .font(.callout)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Text("※ iOSはHCEをサポートしていません。相手が「近くのデバイス」タブから接続、またはこのコードを入力することで接続できます。")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding()
        .onAppear {
            manager.setOutgoingData(payloadData)
            manager.startAdvertising()
        }
        .onDisappear { manager.stopAll() }
    }
}
