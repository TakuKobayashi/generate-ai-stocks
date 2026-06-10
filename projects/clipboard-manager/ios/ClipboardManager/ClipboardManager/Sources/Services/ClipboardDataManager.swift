import Foundation
import Combine

class ClipboardDataManager: ObservableObject {
    static let shared = ClipboardDataManager()
    @Published var items: [ClipboardItem] = []

    private let defaults: UserDefaults
    private let itemsKey = "clipboard_items"
    private let frequentKey = "frequently_used_items"
    private let recentKey = "recent_items"

    private init() {
        defaults = UserDefaults(suiteName: "group.com.example.clipboardmanager") ?? UserDefaults.standard
        loadItems()
    }

    func loadItems() {
        guard let data = defaults.data(forKey: itemsKey),
              let decoded = try? JSONDecoder().decode([ClipboardItem].self, from: data)
        else { return }
        items = decoded
    }

    func insertOrUpdate(content: String) {
        if let index = items.firstIndex(where: { $0.content == content }) {
            items[index].lastUsedAt = Date()
            items[index].usageCount += 1
        } else {
            items.insert(ClipboardItem(content: content), at: 0)
        }
        saveItems()
    }

    func delete(ids: Set<UUID>) {
        items.removeAll { ids.contains($0.id) }
        saveItems()
    }

    func getFiltered(query: String, sortBy: SortOption, ascending: Bool) -> [ClipboardItem] {
        var result = query.count >= 2 ? items.filter { $0.content.localizedCaseInsensitiveContains(query) } : items
        result.sort {
            let cmp: Bool
            switch sortBy {
            case .createdAt:  cmp = $0.createdAt  < $1.createdAt
            case .lastUsedAt: cmp = $0.lastUsedAt < $1.lastUsedAt
            case .usageCount: cmp = $0.usageCount < $1.usageCount
            }
            return ascending ? cmp : !cmp
        }
        return result
    }

    func getFrequentlyUsed(minCount: Int = 2, limit: Int = 20) -> [ClipboardItem] {
        Array(items.filter { $0.usageCount >= minCount }.sorted { $0.usageCount > $1.usageCount }.prefix(limit))
    }

    private func saveItems() {
        if let encoded = try? JSONEncoder().encode(items) {
            defaults.set(encoded, forKey: itemsKey)
        }
        // キーボード/ウィジェット拡張用
        if let encoded = try? JSONEncoder().encode(getFrequentlyUsed()) {
            defaults.set(encoded, forKey: frequentKey)
        }
        if let encoded = try? JSONEncoder().encode(Array(items.prefix(10))) {
            defaults.set(encoded, forKey: recentKey)
        }
    }
}
