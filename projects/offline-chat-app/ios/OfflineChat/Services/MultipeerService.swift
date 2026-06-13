import Foundation
import MultipeerConnectivity

final class MultipeerService: NSObject, ObservableObject {

    static let serviceType = "offlinechat"

    struct PeerInfo: Identifiable, Equatable {
        let id = UUID()
        let peerId: MCPeerID
        let userId: String
        let displayName: String
        let iconPath: String?
        let bio: String?
    }

    @Published var discovered: [PeerInfo] = []
    @Published var connected: [MCPeerID] = []

    private var myPeerId: MCPeerID!
    private var session: MCSession!
    private var advertiser: MCNearbyServiceAdvertiser!
    private var browser: MCNearbyServiceBrowser!

    var onData: ((MCPeerID, Data) -> Void)?
    var onResourceReceived: ((MCPeerID, String, URL?) -> Void)?

    // MARK: - Start

    func start(userId: String, displayName: String, iconPath: String? = nil, bio: String? = nil) {
        stop()
        myPeerId = MCPeerID(displayName: displayName)
        session = MCSession(peer: myPeerId, securityIdentity: nil, encryptionPreference: .required)
        session.delegate = self

        let info: [String: String] = [
            "uid": userId,
            "bio": bio ?? ""
        ]
        advertiser = MCNearbyServiceAdvertiser(peer: myPeerId, discoveryInfo: info, serviceType: Self.serviceType)
        advertiser.delegate = self
        advertiser.startAdvertisingPeer()

        browser = MCNearbyServiceBrowser(peer: myPeerId, serviceType: Self.serviceType)
        browser.delegate = self
        browser.startBrowsingForPeers()
    }

    func stop() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session?.disconnect()
        DispatchQueue.main.async { [weak self] in
            self?.connected = []
            self?.discovered = []
        }
    }

    // MARK: - Send

    func sendData(_ data: Data, to peer: MCPeerID) {
        guard session != nil else { return }
        try? session.send(data, toPeers: [peer], with: .reliable)
    }

    func sendResource(_ url: URL, to peer: MCPeerID) {
        session?.sendResource(at: url, withName: url.lastPathComponent, toPeer: peer) { error in
            if let error { print("[MPC] Resource send error: \(error)") }
        }
    }

    func peerIdForUser(_ userId: String) -> MCPeerID? {
        discovered.first(where: { $0.userId == userId })?.peerId
    }
}

// MARK: - MCSessionDelegate
extension MultipeerService: MCSessionDelegate {
    func session(_ session: MCSession, peer: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            switch state {
            case .connected:
                if !connected.contains(peer) { connected.append(peer) }
            case .notConnected:
                connected.removeAll { $0 == peer }
            default: break
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peer: MCPeerID) {
        onData?(peer, data)
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName name: String, fromPeer peer: MCPeerID) {}

    func session(_ session: MCSession, didStartReceivingResourceWithName name: String, fromPeer peer: MCPeerID, with progress: Progress) {}

    func session(_ session: MCSession, didFinishReceivingResourceWithName name: String, fromPeer peer: MCPeerID, at url: URL?, withError error: Error?) {
        onResourceReceived?(peer, name, url)
    }
}

// MARK: - MCNearbyServiceAdvertiserDelegate
extension MultipeerService: MCNearbyServiceAdvertiserDelegate {
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peer: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        invitationHandler(true, session)
    }
}

// MARK: - MCNearbyServiceBrowserDelegate
extension MultipeerService: MCNearbyServiceBrowserDelegate {
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peer: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        let peerInfo = PeerInfo(
            peerId: peer,
            userId: info?["uid"] ?? peer.displayName,
            displayName: peer.displayName,
            iconPath: nil,
            bio: info?["bio"]
        )
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if !discovered.contains(where: { $0.peerId == peer }) {
                discovered.append(peerInfo)
            }
        }
        // 自動接続
        browser.invitePeer(peer, to: session, withContext: nil, timeout: 30)
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peer: MCPeerID) {
        DispatchQueue.main.async { [weak self] in
            self?.discovered.removeAll { $0.peerId == peer }
            self?.connected.removeAll { $0 == peer }
        }
    }
}
