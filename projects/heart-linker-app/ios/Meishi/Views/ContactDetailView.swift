import SwiftUI

struct ContactDetailView: View {
    let contact: Contact
    var onDeleted: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm = false
    @State private var snsList: [SnsAccount] = []

    var body: some View {
        List {
            // ヘッダー
            Section {
                HStack(spacing: 16) {
                    ProfileIconView(path: contact.iconPath, size: 80)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(contact.name.isEmpty ? "(名前未設定)" : contact.name)
                            .font(.title2.bold())
                    }
                }
                .padding(.vertical, 8)
            }

            // 基本情報
            Section("基本情報") {
                ReadOnlyRow(label: "メールアドレス", value: contact.email)
                ReadOnlyRow(label: "電話番号",     value: contact.phone)
                ReadOnlyRow(label: "住所",         value: contact.address)
            }

            // SNS
            if !snsList.isEmpty {
                Section("SNS / その他連絡先") {
                    ForEach(snsList, id: \.id) { sns in
                        HStack(spacing: 12) {
                            Image(systemName: sns.snsType.symbolName)
                                .frame(width: 20)
                                .foregroundStyle(Color.accentColor)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(sns.displayLabel).font(.caption).foregroundStyle(.secondary)
                                Text(sns.value.isEmpty ? "未設定" : sns.value).font(.body)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("連絡先")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .destructiveAction) {
                Button(role: .destructive) { showDeleteConfirm = true } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .onAppear { snsList = contact.snsAccounts() }
        .confirmationDialog("削除しますか？", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("\(contact.name.isEmpty ? "この連絡先" : contact.name)を削除", role: .destructive) {
                contact.delete()
                onDeleted?()
                dismiss()
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("この操作は元に戻せません")
        }
    }
}

private struct ReadOnlyRow: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value.isEmpty ? "未設定" : value).font(.body)
        }
        .padding(.vertical, 2)
    }
}
