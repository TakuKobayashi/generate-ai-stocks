import Foundation
import MultipeerConnectivity

// MARK: - NearbyTransferManager

/// MultipeerConnectivity (Bluetooth + Wi-Fi) を使った名刺データ送受信ラッパー。
/// Android の NearbyTransferManager と対称的な設計にする。
/// iOS同士のみ対応 (Android の Nearby Connections とは通信不可)。
final class NearbyTransferManager: NSObject, ObservableObject {

    // MARK: - Published state

    @Published var discoveredPeers: [(MCPeerID, String)] = []  // (peerID, displayName)
    @Published var status: String = ""
    @Published var isConnected: Bool = false

    // MARK: - Private

    private let myPeerID: MCPeerID
    private let serviceType = "meishi-app"   // Bonjour service type (英数 + ハイフン, 15文字以内)
    private var session: MCSession!
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?

    private var outgoingData: Data?
    private var onPayloadReceived: ((Data) -> Void)?
    private var onConnectedCallback: (() -> Void)?

    init(displayName: String) {
        myPeerID = MCPeerID(displayName: displayName)
        super.init()
        session = MCSession(peer: myPeerID, securityIdentity: nil, encryptionPreference: .required)
        session.delegate = self
    }

    // MARK: - Public API

    func setOutgoingData(_ data: Data) { outgoingData = data }
    func onPayloadReceived(_ handler: @escaping (Data) -> Void) { onPayloadReceived = handler }
    func onConnected(_ handler: @escaping () -> Void) { onConnectedCallback = handler }

    func startAdvertising() {
        let info: [String: String] = ["displayName": myPeerID.displayName]
        advertiser = MCNearbyServiceAdvertiser(peer: myPeerID, discoveryInfo: info, serviceType: serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()
        DispatchQueue.main.async { self.status = "周囲のデバイスからの接続を待っています…" }
    }

    func startBrowsing() {
        browser = MCNearbyServiceBrowser(peer: myPeerID, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()
        DispatchQueue.main.async { self.status = "周囲のデバイスを検索しています…" }
    }

    func connect(to peerID: MCPeerID) {
        browser?.invitePeer(peerID, to: session, withContext: nil, timeout: 30)
        DispatchQueue.main.async { self.status = "接続しています…" }
    }

    func stopAll() {
        advertiser?.stopAdvertisingPeer(); advertiser = nil
        browser?.stopBrowsingForPeers(); browser = nil
        session.disconnect()
        DispatchQueue.main.async {
            self.discoveredPeers = []
            self.isConnected = false
        }
    }

    // MARK: - Private

    private func sendOutgoingData(to peer: MCPeerID) {
        guard let data = outgoingData else { return }
        try? session.send(data, toPeers: [peer], with: .reliable)
    }
}

// MARK: - MCSessionDelegate

extension NearbyTransferManager: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            switch state {
            case .connected:
                self.status = "接続しました"
                self.isConnected = true
                self.onConnectedCallback?()
                self.sendOutgoingData(to: peerID)
            case .notConnected:
                self.status = "切断されました"
                self.isConnected = false
            default: break
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        DispatchQueue.main.async { self.onPayloadReceived?(data) }
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

// MARK: - MCNearbyServiceAdvertiserDelegate

extension NearbyTransferManager: MCNearbyServiceAdvertiserDelegate {
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // 名刺交換アプリ同士なので自動的に受け入れる
        invitationHandler(true, session)
    }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension NearbyTransferManager: MCNearbyServiceBrowserDelegate {
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        DispatchQueue.main.async {
            if !self.discoveredPeers.contains(where: { $0.0 == peerID }) {
                self.discoveredPeers.append((peerID, info?["displayName"] ?? peerID.displayName))
            }
        }
    }
    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        DispatchQueue.main.async { self.discoveredPeers.removeAll { $0.0 == peerID } }
    }
    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        DispatchQueue.main.async { self.status = "検索を開始できませんでした: \(error.localizedDescription)" }
    }
}
