import SwiftUI
import PhotosUI

// MARK: - SnsRowItem (ViewModel用の値型)

struct SnsRowItem: Identifiable {
    var id: String    // DB上のid or 一時UUID
    var type: SnsType
    var value: String
    var serviceName: String
    var label: String { type == .other && !serviceName.isEmpty ? serviceName : type.displayName }
}

// MARK: - EditProfileView

struct EditProfileView: View {
    @Environment(\.dismiss) private var dismiss

    // 下書き
    @State private var draft: ProfileDraft
    @State private var name: String
    @State private var email: String
    @State private var phone: String
    @State private var address: String
    @State private var iconPath: String?
    @State private var snsRows: [SnsRowItem]

    @State private var showSnsPicker = false
    @State private var selectedPhoto: PhotosPickerItem? = nil
    @State private var showDiscardConfirm = false

    init() {
        let d = ProfileDraft.findExisting() ?? ProfileDraft.createFrom(Profile.current())
        _draft = State(initialValue: d)
        _name = State(initialValue: d.name)
        _email = State(initialValue: d.email)
        _phone = State(initialValue: d.phone)
        _address = State(initialValue: d.address)
        _iconPath = State(initialValue: d.iconPath)
        _snsRows = State(initialValue: d.snsAccounts().map {
            SnsRowItem(id: String($0.id), type: $0.snsType, value: $0.value, serviceName: $0.serviceName)
        })
    }

    var body: some View {
        NavigationStack {
            Form {
                // --- アイコン ---
                Section {
                    HStack {
                        Spacer()
                        PhotosPicker(selection: $selectedPhoto, matching: .images) {
                            VStack(spacing: 6) {
                                ProfileIconView(path: iconPath, size: 96)
                                Text("タップして変更")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                    .padding(.vertical, 8)
                }

                // --- 基本情報 ---
                Section("基本情報") {
                    LabeledTextField("名前", text: $name, onChanged: persistDraftHeader)
                    LabeledTextField("メールアドレス", text: $email, keyboard: .emailAddress, onChanged: persistDraftHeader)
                    LabeledTextField("電話番号", text: $phone, keyboard: .phonePad, onChanged: persistDraftHeader)
                    LabeledTextField("住所", text: $address, onChanged: persistDraftHeader)
                }

                // --- SNS ---
                Section {
                    ForEach($snsRows) { $row in
                        HStack(spacing: 10) {
                            Image(systemName: row.type.symbolName)
                                .frame(width: 20)
                                .foregroundStyle(Color.accentColor)
                            TextField(row.label, text: $row.value)
                                .onChange(of: row.value) { _, newVal in persistSnsRow(row, value: newVal) }
                        }
                    }
                    .onMove(perform: moveSnsRows)
                    .onDelete(perform: deleteSnsRows)

                    Button {
                        showSnsPicker = true
                    } label: {
                        Label("SNSを追加", systemImage: "plus.circle")
                    }
                } header: {
                    HStack {
                        Text("SNS / その他連絡先")
                        Spacer()
                        EditButton()
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("名刺を編集")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("元に戻す") { showDiscardConfirm = true }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { saveAndDismiss() }
                }
            }
            .sheet(isPresented: $showSnsPicker) {
                SnsPickerSheet { type, customName in
                    addSns(type: type, customName: customName)
                }
            }
            .onChange(of: selectedPhoto) { _, item in
                Task { await loadPhoto(item) }
            }
            .confirmationDialog("変更を破棄しますか？", isPresented: $showDiscardConfirm, titleVisibility: .visible) {
                Button("元に戻す", role: .destructive) { discardAndDismiss() }
                Button("キャンセル", role: .cancel) {}
            }
        }
    }

    // MARK: - Actions

    private func persistDraftHeader() {
        draft.name = name; draft.email = email; draft.phone = phone
        draft.address = address; draft.iconPath = iconPath
        draft.save()
    }

    private func persistSnsRow(_ row: SnsRowItem, value: String) {
        guard let dbId = Int64(row.id) else { return }
        let sns = SnsAccount.forDraft(draftId: draft.id, snsType: row.type, value: value,
                                     sortOrder: 0, serviceName: row.serviceName)
        sns.id = dbId; sns.save()
    }

    private func addSns(type: SnsType, customName: String) {
        let label = type == .other ? customName.ifEmpty("その他") : type.displayName
        let sns = SnsAccount.forDraft(draftId: draft.id, snsType: type, value: "", sortOrder: snsRows.count, serviceName: customName)
        sns.save()
        snsRows.append(SnsRowItem(id: String(sns.id), type: type, value: "", serviceName: customName))
    }

    private func moveSnsRows(from source: IndexSet, to dest: Int) {
        snsRows.move(fromOffsets: source, toOffset: dest)
        snsRows.enumerated().forEach { idx, row in
            guard let dbId = Int64(row.id) else { return }
            let sns = SnsAccount.forDraft(draftId: draft.id, snsType: row.type, value: row.value,
                                         sortOrder: idx, serviceName: row.serviceName)
            sns.id = dbId; sns.save()
        }
    }

    private func deleteSnsRows(at offsets: IndexSet) {
        offsets.forEach { idx in
            let row = snsRows[idx]
            if let dbId = Int64(row.id) {
                let sns = SnsAccount.forDraft(draftId: draft.id, snsType: row.type, value: row.value, sortOrder: idx)
                sns.id = dbId; sns.delete()
            }
        }
        snsRows.remove(atOffsets: offsets)
    }

    private func saveAndDismiss() {
        let profile = Profile.current()
        profile.name = name; profile.email = email; profile.phone = phone
        profile.address = address; profile.iconPath = iconPath
        profile.save()
        SnsAccount.deleteAll(table: "profile_sns", parentColumn: "profile_id", parentId: profile.id)
        snsRows.enumerated().forEach { idx, row in
            SnsAccount.forProfile(profileId: profile.id, snsType: row.type, value: row.value,
                                  sortOrder: idx, serviceName: row.serviceName).save()
        }
        draft.clear()
        dismiss()
    }

    private func discardAndDismiss() {
        draft.clear()
        dismiss()
    }

    @MainActor
    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self) else { return }
        guard let img = UIImage(data: data) else { return }
        iconPath = ImageUtil.saveImage(img)
        persistDraftHeader()
    }
}

// MARK: - Helpers

private struct LabeledTextField: View {
    let label: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var onChanged: () -> Void

    var body: some View {
        TextField(label, text: $text)
            .keyboardType(keyboard)
            .onChange(of: text) { _, _ in onChanged() }
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}
