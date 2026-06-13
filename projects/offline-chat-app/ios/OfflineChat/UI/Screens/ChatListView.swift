import SwiftUI

struct ChatListView: View {
    @EnvironmentObject var viewModel: ChatViewModel
    @State private var navigateToChat = false

    var body: some View {
        Group {
            if viewModel.chatRooms.isEmpty {
                ContentUnavailableView("チャット履歴がありません",
                    systemImage: "message.fill")
            } else {
                List(viewModel.chatRooms) { room in
                    Button {
                        viewModel.selectRoom(room)
                        navigateToChat = true
                    } label: {
                        ChatRoomRow(room: room)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("チャット")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(isPresented: $navigateToChat) { ChatView() }
        .onAppear { viewModel.loadChatRooms() }
    }
}

struct ChatRoomRow: View {
    @EnvironmentObject var viewModel: ChatViewModel
    let room: ChatRoomModel

    var body: some View {
        let peer = viewModel.peerUser(for: room)
        let isOnline = viewModel.isNearby(room.peerUserId)
        let isNew = room.lastMessage == nil && !room.isRequestPending

        HStack(spacing: 12) {
            Circle()
                .fill(Color.purple.gradient)
                .frame(width: 52, height: 52)
                .overlay {
                    Text(String((peer?.displayName ?? "?").prefix(1)))
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                }
                .overlay(alignment: .bottomTrailing) {
                    if isOnline {
                        Circle().fill(.green).frame(width: 14, height: 14)
                            .overlay { Circle().stroke(.white, lineWidth: 2) }
                    }
                }

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(peer?.displayName ?? room.peerUserId)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer()
                    if let t = room.lastMessageTime {
                        Text(relativeTime(Int64(t)))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                HStack {
                    Text(room.isRequestPending ? "リクエスト送信中…" : (room.lastMessage ?? "メッセージなし"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                    if isNew {
                        Text("NEW").font(.caption2.bold()).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 3)
                            .background(.blue, in: Capsule())
                    } else if room.isRequestPending {
                        ProgressView().scaleEffect(0.7)
                    } else if room.unreadCount > 0 {
                        Text(room.unreadCount > 99 ? "99+" : "\(room.unreadCount)")
                            .font(.caption2.bold()).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 3)
                            .background(.red, in: Capsule())
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func relativeTime(_ ts: Int64) -> String {
        let diff = Int64(Date().timeIntervalSince1970) - ts
        if diff < 60 { return "今" }
        if diff < 3600 { return "\(diff / 60)分前" }
        let d = Date(timeIntervalSince1970: TimeInterval(ts))
        let fmt = DateFormatter(); fmt.dateFormat = diff < 86400 ? "HH:mm" : "MM/dd"
        return fmt.string(from: d)
    }
}
