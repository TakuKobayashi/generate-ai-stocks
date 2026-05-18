import SwiftUI
import Combine

// ─────────────────────────────────────────────────────────────────────────
//  NotificationsView
// ─────────────────────────────────────────────────────────────────────────

struct NotificationsView: View {
    @StateObject private var vm = NotificationsViewModel()

    var body: some View {
        Group {
            if vm.loading && vm.notifications.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if vm.notifications.isEmpty {
                emptyState
            } else {
                list
            }
        }
        .navigationTitle(vm.unreadCount > 0 ? "通知（\(vm.unreadCount)）" : "通知")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                Button {
                    Task { await vm.sync() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(vm.loading)

                if vm.unreadCount > 0 {
                    Button("全て既読") {
                        Task { await vm.markAllAsRead() }
                    }
                    .font(.caption).fontWeight(.semibold)
                    .foregroundColor(.beerAmber)
                }
            }
        }
        .task { await vm.sync() }
        .alert("エラー", isPresented: .constant(vm.error != nil)) {
            Button("OK") { vm.error = nil }
        } message: {
            Text(vm.error ?? "")
        }
    }

    private var list: some View {
        List {
            ForEach(vm.notifications) { notification in
                NotificationRow(notification: notification)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .padding(.horizontal)
                    .onTapGesture {
                        Task { await vm.markAsRead(notification) }
                    }
            }
        }
        .listStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Text("🍺").font(.system(size: 64))
            Text("まだ通知がありません")
                .font(.headline)
                .foregroundColor(Color(.secondaryLabel))
            Text("友達が飲みに誘ってくれると\nここに表示されます")
                .font(.subheadline)
                .foregroundColor(Color(.tertiaryLabel))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  NotificationsViewModel
//  NotificationRecord の Combine Publisher を購読して画面を自動更新
// ─────────────────────────────────────────────────────────────────────────

@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var notifications: [NotificationRecord] = []
    @Published var unreadCount: Int = 0
    @Published var loading = false
    @Published var error: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        observeDB()
    }

    // DB の変更を Combine で監視（ActiveRecord.observeForUser）
    private func observeDB() {
        guard let user = try? UserRecord.findCurrent() else { return }

        NotificationRecord.observeForUser(userId: user.id)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { [weak self] records in
                    self?.notifications = records
                    self?.unreadCount = records.filter(\.isUnread).count
                }
            )
            .store(in: &cancellables)
    }

    // サーバーから最新通知を取得してLocalDBと同期
    func sync() async {
        loading = true
        do {
            try await NotificationService.shared.syncFromServer()
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    // 既読にする（ローカルDB即時更新 → Combine Publisher が自動で画面反映）
    func markAsRead(_ record: NotificationRecord) async {
        do {
            try await NotificationService.shared.markAsRead(record)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markAllAsRead() async {
        do {
            try await NotificationService.shared.markAllAsRead()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  NotificationRow - 通知セル
// ─────────────────────────────────────────────────────────────────────────

struct NotificationRow: View {
    let notification: NotificationRecord

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // アイコン + 未読ドット
            ZStack(alignment: .topTrailing) {
                ZStack {
                    Circle()
                        .fill(Color.beerAmber.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Text("🍺").font(.title3)
                }
                if notification.isUnread {
                    Circle()
                        .fill(Color.beerAmber)
                        .frame(width: 10, height: 10)
                        .offset(x: 2, y: -2)
                }
            }

            // テキスト
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(notification.title)
                        .font(.subheadline)
                        .fontWeight(notification.isUnread ? .semibold : .regular)
                        .lineLimit(1)
                    Spacer()
                    Text(notification.createdDate, style: .relative)
                        .font(.caption2)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Text(notification.body)
                    .font(.caption)
                    .foregroundColor(Color(.secondaryLabel))
                    .lineLimit(3)

                if notification.inviteId != nil {
                    Label("詳細を見る", systemImage: "chevron.right")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(.beerAmber)
                        .padding(.top, 2)
                }
            }
        }
        .padding(.vertical, 12)
        .background(notification.isUnread ? Color.beerAmber.opacity(0.05) : Color.clear)
        .overlay(
            Divider().padding(.leading, 68),
            alignment: .bottom
        )
    }
}
