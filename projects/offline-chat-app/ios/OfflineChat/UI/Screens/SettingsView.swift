import SwiftUI
import PhotosUI

struct SettingsView: View {
    @EnvironmentObject var viewModel: ChatViewModel
    @State private var displayName = ""
    @State private var bio = ""
    @State private var isDiscoverable = true
    @State private var saved = false
    @State private var showPastChats = false
    @State private var photosPickerItem: PhotosPickerItem?

    var body: some View {
        Form {
            // アイコン
            Section {
                HStack {
                    Spacer()
                    ZStack(alignment: .bottomTrailing) {
                        Circle()
                            .fill(Color.blue.gradient)
                            .frame(width: 90, height: 90)
                            .overlay {
                                Text(String((viewModel.me?.displayName ?? "?").prefix(1)))
                                    .font(.largeTitle.bold())
                                    .foregroundStyle(.white)
                            }
                        PhotosPicker(selection: $photosPickerItem, matching: .images) {
                            Image(systemName: "camera.fill")
                                .font(.caption)
                                .foregroundStyle(.white)
                                .padding(6)
                                .background(.blue, in: Circle())
                        }
                    }
                    Spacer()
                }
                .listRowBackground(Color.clear)

                // ユーザーID
                LabeledContent("ユーザーID") {
                    Text(viewModel.me?.id ?? "")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }

            Section("プロフィール") {
                TextField("表示名", text: $displayName)
                TextField("自己紹介 (Bio)", text: $bio, axis: .vertical)
                    .lineLimit(3...6)
            }

            Section {
                Toggle("ユーザー一覧に表示", isOn: $isDiscoverable)
                    .onChange(of: isDiscoverable) { _, v in viewModel.setDiscoverable(v) }
            } footer: {
                Text("オフにすると近くの人に見えなくなります")
            }

            Section {
                Button {
                    viewModel.updateProfile(displayName: displayName,
                                            bio: bio.isEmpty ? nil : bio,
                                            iconPath: viewModel.me?.iconPath)
                    saved = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { saved = false }
                } label: {
                    Label(saved ? "保存済み ✓" : "保存", systemImage: saved ? "checkmark" : "square.and.arrow.down")
                }
                .disabled(displayName.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            Section {
                NavigationLink("過去にやり取りした人を管理") {
                    PastChatsView()
                }
            }
        }
        .navigationTitle("設定")
        .navigationBarTitleDisplayMode(.large)
        .onAppear {
            displayName = viewModel.me?.displayName ?? ""
            bio = viewModel.me?.bio ?? ""
            isDiscoverable = viewModel.me?.isDiscoverable ?? true
        }
    }
}
