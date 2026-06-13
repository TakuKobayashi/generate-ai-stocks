import SwiftUI

struct PastChatsView: View {
    @EnvironmentObject var viewModel: ChatViewModel
    @State private var confirmDelete: ChatRoomModel?

    var body: some View {
        Group {
            if viewModel.chatRooms.isEmpty {
                ContentUnavailableView("チャット履歴がありません", systemImage: "tray")
            } else {
                List {
                    ForEach(viewModel.chatRooms) { room in
                        let peer = viewModel.peerUser(for: room)
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Color.purple.gradient)
                                .frame(width: 44, height: 44)
                                .overlay {
                                    Text(String((peer?.displayName ?? "?").prefix(1)))
                                        .font(.title3.bold())
                                        .foregroundStyle(.white)
                                }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(peer?.displayName ?? room.peerUserId)
                                    .font(.headline)
                                Text(room.lastMessage ?? "メッセージなし")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) { confirmDelete = room } label: {
                                Label("削除", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("過去にやり取りした人")
        .navigationBarTitleDisplayMode(.large)
        .onAppear { viewModel.loadChatRooms() }
        .confirmationDialog("チャット履歴を削除しますか？",
            isPresented: .constant(confirmDelete != nil), titleVisibility: .visible) {
            Button("削除", role: .destructive) {
                if let r = confirmDelete { viewModel.deleteChatRoom(r) }
                confirmDelete = nil
            }
            Button("キャンセル", role: .cancel) { confirmDelete = nil }
        }
    }
}
