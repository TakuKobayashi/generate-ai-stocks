import Foundation

struct ClipboardItem: Identifiable, Codable, Equatable {
    let id: UUID
    var content: String
    var createdAt: Date
    var lastUsedAt: Date
    var usageCount: Int

    init(id: UUID = UUID(), content: String, createdAt: Date = Date(), lastUsedAt: Date = Date(), usageCount: Int = 1) {
        self.id = id; self.content = content
        self.createdAt = createdAt; self.lastUsedAt = lastUsedAt; self.usageCount = usageCount
    }

    func previewText(maxLength: Int = 100) -> String {
        content.count > maxLength ? String(content.prefix(maxLength)) + "..." : content
    }
}

enum SortOption: String, CaseIterable, Identifiable {
    case createdAt = "作成日時"
    case lastUsedAt = "最終使用"
    case usageCount = "使用回数"
    var id: String { rawValue }
}
