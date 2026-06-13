import SwiftUI
import PhotosUI

struct ChatView: View {
    @EnvironmentObject var viewModel: ChatViewModel
    @State private var inputText = ""
    @State private var photosPickerItem: PhotosPickerItem?

    var body: some View {
        let room = viewModel.currentRoom
        let peer = room.flatMap { viewModel.peerUser(for: $0) }
        let isNearby = room.map { viewModel.isNearby($0.peerUserId) } ?? false

        VStack(spacing: 0) {
            if room?.isRequestPending == true {
                // リクエスト待機中
                Spacer()
                VStack(spacing: 16) {
                    ProgressView()
                    Text("リクエスト送信中…")
                        .font(.headline)
                    Text("相手が許可するまでお待ちください")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            } else {
                // メッセージ一覧
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 6) {
                            ForEach(viewModel.messages) { msg in
                                MessageBubble(msg: msg, isMine: msg.senderId == viewModel.me?.id)
                                    .id(msg.id)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                    }
                    .onChange(of: viewModel.messages.count) { _, _ in
                        if let last = viewModel.messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }

                Divider()

                // 入力エリア
                HStack(spacing: 8) {
                    PhotosPicker(selection: $photosPickerItem, matching: .images) {
                        Image(systemName: "paperclip")
                            .font(.title3)
                            .foregroundStyle(.blue)
                    }
                    .onChange(of: photosPickerItem) { _, item in
                        // 画像送信 (簡略化)
                        photosPickerItem = nil
                    }

                    TextField("メッセージを入力", text: $inputText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(1...4)

                    Button {
                        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        viewModel.sendText(inputText.trimmingCharacters(in: .whitespaces))
                        inputText = ""
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .font(.title3)
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(10)
            }
        }
        .navigationTitle(peer?.displayName ?? "チャット")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text(peer?.displayName ?? "チャット")
                        .font(.headline)
                    Text(isNearby ? "● オンライン" : "○ オフライン")
                        .font(.caption)
                        .foregroundStyle(isNearby ? Color.green : Color.secondary)
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { /* 音声通話 */ } label: {
                    Image(systemName: "phone")
                }
            }
        }
    }
}

struct MessageBubble: View {
    let msg: MessageModel
    let isMine: Bool

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 60) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 3) {
                Text(bubbleText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(isMine ? Color.blue : Color(.systemGray5),
                                in: RoundedRectangle(cornerRadius: 16,
                                    style: .continuous))
                    .foregroundStyle(isMine ? Color.white : Color.primary)

                HStack(spacing: 3) {
                    Text(formattedTime)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if isMine {
                        Text(statusSymbol)
                            .font(.caption2)
                            .foregroundStyle(msg.isRead ? .blue : .secondary)
                    }
                }
                .padding(.horizontal, 4)
            }
            if !isMine { Spacer(minLength: 60) }
        }
    }

    private var bubbleText: String {
        switch msg.messageType {
        case .image: return "🖼 [画像]"
        case .file:  return "📎 \(msg.fileName ?? "ファイル")"
        default:     return msg.content ?? ""
        }
    }

    private var statusSymbol: String {
        if msg.isRead      { return "✓✓" }
        if msg.isDelivered { return "✓✓" }
        if msg.isSent      { return "✓" }
        return "⏱"
    }

    private var formattedTime: String {
        let d = Date(timeIntervalSince1970: TimeInterval(msg.createdAt))
        let fmt = DateFormatter(); fmt.dateFormat = "HH:mm"
        return fmt.string(from: d)
    }
}
