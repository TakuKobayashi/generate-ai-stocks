import SwiftUI

struct SnsPickerSheet: View {
    var onSelect: (SnsType, String) -> Void   // (type, customServiceName)
    @Environment(\.dismiss) private var dismiss
    @State private var showOtherInput = false
    @State private var otherName = ""

    var body: some View {
        NavigationStack {
            List {
                Section("主要SNS") {
                    ForEach(SnsType.primary) { type in
                        Button {
                            onSelect(type, "")
                            dismiss()
                        } label: {
                            SnsPickerRow(type: type, label: type.displayName)
                        }
                    }
                }
                Section("その他") {
                    ForEach(SnsType.others) { type in
                        if type == .other {
                            Button { showOtherInput = true } label: {
                                SnsPickerRow(type: type, label: "その他(名前を入力)")
                            }
                        } else {
                            Button {
                                onSelect(type, "")
                                dismiss()
                            } label: {
                                SnsPickerRow(type: type, label: type.displayName)
                            }
                        }
                    }
                }
            }
            .navigationTitle("SNSを追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
            .alert("サービス名を入力", isPresented: $showOtherInput) {
                TextField("例: note, Threads など", text: $otherName)
                Button("追加") {
                    onSelect(.other, otherName.isEmpty ? "その他" : otherName)
                    otherName = ""
                    dismiss()
                }
                Button("キャンセル", role: .cancel) { otherName = "" }
            } message: {
                Text("追加するSNS・サービスの名前を入力してください")
            }
        }
    }
}

struct SnsPickerRow: View {
    let type: SnsType
    let label: String
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: type.symbolName)
                .frame(width: 22, height: 22)
                .foregroundStyle(.secondary)
            Text(label)
        }
    }
}
