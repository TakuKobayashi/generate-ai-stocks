import SwiftUI

struct ContactListView: View {
    @State private var profile = Profile.current()
    @State private var contacts: [Contact] = []
    @State private var showEdit = false
    @State private var showSend = false
    @State private var showReceive = false
    @State private var selectedContact: Contact? = nil

    var body: some View {
        NavigationStack {
            List {
                // 自分の名刺プレビュー
                Section {
                    Button { showEdit = true } label: {
                        HStack(spacing: 12) {
                            ProfileIconView(path: profile.iconPath, size: 56)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.name.isEmpty ? "(自分の名刺を入力)" : profile.name)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text(profile.email.isEmpty ? "未設定" : profile.email)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "pencil")
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                } header: { Text("自分の名刺") }

                // 交換した連絡先
                Section {
                    if contacts.isEmpty {
                        Text("まだ連絡先がありません\n「受信」から交換しましょう")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else {
                        ForEach(contacts, id: \.id) { contact in
                            Button { selectedContact = contact } label: {
                                ContactRowView(contact: contact)
                            }
                        }
                        .onDelete(perform: deleteContacts)
                    }
                } header: { Text("交換した連絡先") }
            }
            .navigationTitle("名刺帳")
            .toolbar {
                ToolbarItemGroup(placement: .bottomBar) {
                    Spacer()
                    Button { showSend = true } label: {
                        Label("送信", systemImage: "qrcode")
                    }
                    Spacer()
                    Button { showReceive = true } label: {
                        Label("受信", systemImage: "qrcode.viewfinder")
                    }
                    Spacer()
                }
            }
            .onAppear(perform: reload)
            .sheet(isPresented: $showEdit, onDismiss: reload) {
                EditProfileView()
            }
            .sheet(isPresented: $showSend) {
                SendView()
            }
            .sheet(isPresented: $showReceive, onDismiss: reload) {
                ReceiveView(onReceived: { contact in
                    showReceive = false
                    reload()
                    selectedContact = contact
                })
            }
            .navigationDestination(item: $selectedContact) { contact in
                ContactDetailView(contact: contact, onDeleted: {
                    selectedContact = nil
                    reload()
                })
            }
        }
    }

    private func reload() {
        profile = Profile.current()
        contacts = Contact.findAll()
    }

    private func deleteContacts(at offsets: IndexSet) {
        offsets.map { contacts[$0] }.forEach { $0.delete() }
        contacts.remove(atOffsets: offsets)
    }
}

struct ContactRowView: View {
    let contact: Contact
    var body: some View {
        HStack(spacing: 12) {
            ProfileIconView(path: contact.iconPath, size: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.name.isEmpty ? "(名前未設定)" : contact.name)
                    .font(.headline)
                let sub = [contact.email, contact.phone].filter { !$0.isEmpty }.joined(separator: "  /  ")
                if !sub.isEmpty {
                    Text(sub).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .foregroundStyle(.primary)
        .padding(.vertical, 2)
    }
}

struct ProfileIconView: View {
    let path: String?
    let size: CGFloat

    var body: some View {
        Group {
            if let path, let img = ImageUtil.image(at: path) {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}
