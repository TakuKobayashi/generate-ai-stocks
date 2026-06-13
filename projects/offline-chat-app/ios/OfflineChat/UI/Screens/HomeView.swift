import SwiftUI

struct HomeView: View {
    @EnvironmentObject var viewModel: ChatViewModel
    @State private var navigateToChat = false
    @State private var navigateToChatList = false
    @State private var navigateToSettings = false

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // 簡易地図プレースホルダー
                ZStack {
                    Color(.systemGray6)
                    VStack(spacing: 4) {
                        Text("📍")
                            .font(.largeTitle)
                        Text(viewModel.me?.displayName ?? "自分")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("(地図はMapKitで実装可能)")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                .frame(height: 150)

                Divider()

                // 近くのユーザー一覧
                if viewModel.nearbyPeers.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Text("📡")
                            .font(.system(size: 48))
                        Text("近くにユーザーが見つかりません")
                            .font(.headline)
                        Text("アプリを起動しているユーザーを探しています…")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    Spacer()
                } else {
                    List(viewModel.nearbyPeers) { peer in
                        Button {
                            viewModel.openChatWith(userId: peer.userId)
                            navigateToChat = true
                        } label: {
                            NearbyPeerRow(peer: peer)
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.plain)
                }
            }

            // リクエストダイアログ
            if let req = viewModel.pendingRequests.first {
                Color.black.opacity(0.3).ignoresSafeArea()
                    .onTapGesture {}
                VStack(spacing: 16) {
                    Text("チャットリクエスト")
                        .font(.headline)
                    Text("\(req.fromDisplayName) からリクエストが届きました")
                    HStack(spacing: 16) {
                        Button("拒否") { viewModel.declineRequest(req) }
                            .buttonStyle(.bordered)
                        Button("許可") { viewModel.acceptRequest(req) }
                            .buttonStyle(.borderedProminent)
                    }
                }
                .padding(24)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                .padding(32)
            }
        }
        .navigationTitle("近くの人")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack {
                    Button { navigateToChatList = true } label: {
                        Image(systemName: "message")
                    }
                    Button { navigateToSettings = true } label: {
                        Image(systemName: "gear")
                    }
                }
            }
        }
        .navigationDestination(isPresented: $navigateToChat) { ChatView() }
        .navigationDestination(isPresented: $navigateToChatList) { ChatListView() }
        .navigationDestination(isPresented: $navigateToSettings) { SettingsView() }
    }
}

struct NearbyPeerRow: View {
    let peer: MultipeerService.PeerInfo

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.blue.gradient)
                .frame(width: 48, height: 48)
                .overlay {
                    Text(String(peer.displayName.prefix(1)))
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                }
                .overlay(alignment: .bottomTrailing) {
                    Circle().fill(.green).frame(width: 12, height: 12)
                        .overlay { Circle().stroke(.white, lineWidth: 2) }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(peer.displayName)
                    .font(.headline)
                if let bio = peer.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text("NEW")
                .font(.caption2.bold())
                .foregroundStyle(.white)
                .padding(.horizontal, 6).padding(.vertical, 3)
                .background(.blue, in: Capsule())
        }
        .padding(.vertical, 4)
    }
}
