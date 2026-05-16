import SwiftUI

// ─────────────────────────────────────────────────────────────────────────
//  FriendView - フレンド一覧・追加画面
// ─────────────────────────────────────────────────────────────────────────

struct FriendView: View {
    @StateObject private var vm = FriendViewModel()

    var body: some View {
        List {
            // 自分のIDを共有するセクション
            Section {
                myIdSection
            } header: {
                Text("自分のID")
            } footer: {
                Text("このIDを友達に送ると、友達があなたを登録できます")
            }

            // フレンド一覧
            Section {
                if vm.loading {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                } else if vm.friends.isEmpty {
                    Text("まだフレンドがいません")
                        .foregroundColor(.secondary)
                        .font(.subheadline)
                } else {
                    ForEach(vm.friends, id: \.id) { friend in
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color.beerAmber.opacity(0.15))
                                    .frame(width: 40, height: 40)
                                Text(String(friend.name.prefix(1)))
                                    .font(.headline)
                                    .foregroundColor(.beerAmber)
                            }
                            Text(friend.name)
                                .font(.body)
                        }
                    }
                }
            } header: {
                HStack {
                    Text("フレンド(\(vm.friends.count))")
                    Spacer()
                    Button {
                        Task { await vm.loadFriends() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.caption)
                    }
                }
            }
        }
        .navigationTitle("フレンド")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    vm.showAddSheet = true
                } label: {
                    Image(systemName: "person.badge.plus")
                }
            }
        }
        .sheet(isPresented: $vm.showAddSheet) {
            AddFriendSheet(vm: vm)
        }
        .alert("エラー", isPresented: .constant(vm.error != nil)) {
            Button("OK") { vm.error = nil }
        } message: {
            Text(vm.error ?? "")
        }
        .task { await vm.loadFriends() }
    }

    @ViewBuilder
    private var myIdSection: some View {
        if let userId = vm.myUserId {
            VStack(alignment: .leading, spacing: 8) {
                Text(userId)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                Button {
                    UIPasteboard.general.string = userId
                    vm.copiedToClipboard = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        vm.copiedToClipboard = false
                    }
                } label: {
                    Label(
                        vm.copiedToClipboard ? "コピーしました！" : "IDをコピー",
                        systemImage: vm.copiedToClipboard ? "checkmark.circle.fill" : "doc.on.doc"
                    )
                    .font(.subheadline).fontWeight(.semibold)
                    .foregroundColor(vm.copiedToClipboard ? .green : .beerAmber)
                }

                ShareLink(item: "飲みに行きたい！アプリで私のIDは \(userId) です") {
                    Label("IDをシェア", systemImage: "square.and.arrow.up")
                        .font(.subheadline).fontWeight(.semibold)
                        .foregroundColor(.beerAmber)
                }
            }
            .padding(.vertical, 4)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  AddFriendSheet - フレンドID入力シート
// ─────────────────────────────────────────────────────────────────────────

struct AddFriendSheet: View {
    @ObservedObject var vm: FriendViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var friendId = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("友達のID", text: $friendId)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .font(.system(.body, design: .monospaced))
                } header: {
                    Text("追加するIDを入力")
                } footer: {
                    Text("友達の「自分のID」画面に表示されているIDを入力してください")
                }

                if let err = vm.addError {
                    Section {
                        Text(err).foregroundColor(.red).font(.caption)
                    }
                }
            }
            .navigationTitle("フレンドを追加")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("追加") {
                        Task {
                            let ok = await vm.addFriend(friendId: friendId.trimmed)
                            if ok { dismiss() }
                        }
                    }
                    .disabled(friendId.trimmed.isEmpty || vm.adding)
                    .fontWeight(.bold)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  FriendViewModel
// ─────────────────────────────────────────────────────────────────────────

@MainActor
final class FriendViewModel: ObservableObject {
    @Published var friends:  [UserResponse] = []
    @Published var loading   = false
    @Published var adding    = false
    @Published var showAddSheet  = false
    @Published var copiedToClipboard = false
    @Published var error:    String?
    @Published var addError: String?

    var myUserId: String? { try? UserRecord.findCurrent()?.id }

    func loadFriends() async {
        guard let user = try? UserRecord.findCurrent() else { return }
        loading = true
        defer { loading = false }
        do {
            friends = try await APIClient.shared.getFriends(userId: user.id)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// フレンドを追加する。成功なら true を返す。
    func addFriend(friendId: String) async -> Bool {
        guard let user = try? UserRecord.findCurrent() else {
            addError = "ログインが必要です"
            return false
        }
        if friendId == user.id {
            addError = "自分自身は追加できません"
            return false
        }
        adding   = true
        addError = nil
        defer { adding = false }
        do {
            try await APIClient.shared.addFriend(userId: user.id, friendId: friendId)
            await loadFriends()
            return true
        } catch {
            addError = error.localizedDescription
            return false
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespaces) }
}
