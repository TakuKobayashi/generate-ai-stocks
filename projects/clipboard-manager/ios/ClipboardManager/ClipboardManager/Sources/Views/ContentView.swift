import SwiftUI

struct ContentView: View {
    @StateObject private var vm = ClipboardViewModel()
    @StateObject private var store = StoreManager.shared
    @State private var showDeleteAlert = false
    @State private var showPremium = false
    @State private var showCopied = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SearchBarView(text: $vm.searchQuery)
                    .padding(.horizontal).padding(.top, 8)
                SortBarView(current: vm.sortBy, ascending: vm.ascending, onSelect: vm.updateSort)
                    .padding(.horizontal).padding(.vertical, 4)
                if !store.isPremium {
                    BannerAdView().padding(.horizontal, 8)
                }
                ClipboardListView(
                    items: vm.filteredItems, selectedIds: vm.selectedIds,
                    isSelectionMode: vm.isSelectionMode, isPremium: store.isPremium,
                    onTap: handleTap, onLongPress: handleLongPress,
                    onUpgrade: { showPremium = true }
                )
            }
            .navigationTitle("クリップボード履歴")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    if !store.isPremium {
                        Button { showPremium = true } label: {
                            Image(systemName: "star.fill").foregroundColor(.yellow)
                        }
                    }
                    if vm.isSelectionMode {
                        Button { showDeleteAlert = true } label: { Image(systemName: "trash") }
                        Button { vm.toggleSelectionMode() } label: { Image(systemName: "xmark") }
                    }
                }
            }
        }
        .alert("削除確認", isPresented: $showDeleteAlert) {
            Button("キャンセル", role: .cancel) {}
            Button("削除", role: .destructive) { vm.deleteSelected() }
        } message: { Text("\(vm.selectedIds.count)件を削除しますか？") }
        .sheet(isPresented: $showPremium) { PremiumView(store: store) }
        .overlay(alignment: .bottom) {
            if showCopied {
                Text("コピーしました").padding(12)
                    .background(.black.opacity(0.75)).foregroundColor(.white)
                    .cornerRadius(10).padding(.bottom, 50)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: showCopied)
    }

    private func handleTap(_ item: ClipboardItem) {
        if vm.isSelectionMode { vm.toggleSelection(item.id) }
        else {
            vm.copyToClipboard(item)
            showCopied = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { showCopied = false }
        }
    }
    private func handleLongPress(_ item: ClipboardItem) {
        if !vm.isSelectionMode { vm.toggleSelectionMode(); vm.toggleSelection(item.id) }
    }
}

struct SearchBarView: View {
    @Binding var text: String
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundColor(.gray)
            TextField("検索（2文字以上）", text: $text)
            if !text.isEmpty { Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundColor(.gray) } }
        }
        .padding(10).background(Color(.systemGray6)).cornerRadius(10)
    }
}

struct SortBarView: View {
    let current: SortOption; let ascending: Bool; let onSelect: (SortOption) -> Void
    var body: some View {
        HStack(spacing: 8) {
            ForEach(SortOption.allCases) { option in
                let active = current == option
                Button { onSelect(option) } label: {
                    HStack(spacing: 3) {
                        Image(systemName: active ? (ascending ? "arrow.up" : "arrow.down") : "arrow.up.arrow.down").font(.caption2)
                        Text(option.rawValue).font(.caption)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(active ? Color.blue : Color(.systemGray5))
                    .foregroundColor(active ? .white : .primary).cornerRadius(8)
                }
            }
            Spacer()
        }
    }
}

struct ClipboardListView: View {
    let items: [ClipboardItem]; let selectedIds: Set<UUID>
    let isSelectionMode: Bool; let isPremium: Bool
    let onTap: (ClipboardItem) -> Void; let onLongPress: (ClipboardItem) -> Void
    let onUpgrade: () -> Void
    private let freeLimit = 50
    var displayItems: [ClipboardItem] { isPremium ? items : Array(items.prefix(freeLimit)) }

    var body: some View {
        if items.isEmpty {
            VStack { Spacer(); Text("クリップボード履歴がありません").foregroundColor(.gray); Spacer() }
        } else {
            List {
                ForEach(displayItems) { item in
                    ClipboardItemRow(item: item, isSelected: selectedIds.contains(item.id),
                        isSelectionMode: isSelectionMode, onTap: { onTap(item) }, onLongPress: { onLongPress(item) })
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    .listRowSeparator(.hidden)
                }
                if !isPremium && items.count > freeLimit {
                    Button(action: onUpgrade) {
                        HStack {
                            Image(systemName: "star.fill").foregroundColor(.yellow)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("プレミアムで無制限の履歴").font(.subheadline).fontWeight(.medium)
                                Text("あと\(items.count - freeLimit)件ロック中").font(.caption).foregroundColor(.gray)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundColor(.gray)
                        }
                        .padding().background(Color(.systemGray6)).cornerRadius(12)
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
        }
    }
}

struct ClipboardItemRow: View {
    let item: ClipboardItem; let isSelected: Bool; let isSelectionMode: Bool
    let onTap: () -> Void; let onLongPress: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            if isSelectionMode {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .blue : .gray).font(.title3)
            } else {
                ZStack {
                    Circle().fill(Color.blue.opacity(0.15)).frame(width: 40, height: 40)
                    Text("\(item.usageCount)").font(.caption).fontWeight(.semibold).foregroundColor(.blue)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(item.content).font(.body).lineLimit(2)
                Text("\(item.lastUsedAt, style: .relative)前に使用").font(.caption2).foregroundColor(.gray)
            }
            Spacer()
        }
        .padding(12)
        .background(isSelected ? Color.blue.opacity(0.08) : Color(.systemBackground))
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.systemGray5), lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onLongPressGesture(perform: onLongPress)
    }
}
