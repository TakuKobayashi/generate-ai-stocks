import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct ClipboardProvider: TimelineProvider {
    private let defaults = UserDefaults(suiteName: "group.com.example.clipboardmanager")

    func placeholder(in context: Context) -> ClipboardEntry {
        ClipboardEntry(date: Date(), items: sampleItems)
    }

    func getSnapshot(in context: Context, completion: @escaping (ClipboardEntry) -> Void) {
        completion(ClipboardEntry(date: Date(), items: loadItems()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ClipboardEntry>) -> Void) {
        let entry = ClipboardEntry(date: Date(), items: loadItems())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadItems() -> [ClipboardItem] {
        guard let data = defaults?.data(forKey: "recent_items"),
              let items = try? JSONDecoder().decode([ClipboardItem].self, from: data)
        else { return sampleItems }
        return Array(items.prefix(5))
    }

    private var sampleItems: [ClipboardItem] {
        (1...3).map { ClipboardItem(content: "クリップボード項目 \($0)", usageCount: $0) }
    }
}

// MARK: - Entry
struct ClipboardEntry: TimelineEntry {
    let date: Date
    let items: [ClipboardItem]
}

// MARK: - Widget View
struct ClipboardWidgetEntryView: View {
    let entry: ClipboardEntry
    @Environment(\.widgetFamily) var family

    var itemCount: Int {
        switch family {
        case .systemSmall: return 2
        case .systemLarge: return 5
        default: return 3
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "doc.on.clipboard.fill").foregroundColor(.blue).font(.caption)
                Text("クリップボード").font(.caption).fontWeight(.bold).foregroundColor(.blue)
                Spacer()
            }
            .padding(.bottom, 2)

            if entry.items.isEmpty {
                Text("履歴がありません").font(.caption).foregroundColor(.gray)
                    .frame(maxWidth: .infinity, alignment: .center)
            } else {
                ForEach(Array(entry.items.prefix(itemCount))) { item in
                    Link(destination: URL(string: "clipboardmanager://copy/\(item.id.uuidString)")!) {
                        HStack(spacing: 6) {
                            Text(item.previewText(maxLength: family == .systemSmall ? 20 : 35))
                                .font(.caption).lineLimit(1).foregroundColor(.primary)
                            Spacer()
                            Text("\(item.usageCount)x").font(.caption2).foregroundColor(.blue)
                        }
                        .padding(6).background(Color(.systemGray6)).cornerRadius(6)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
    }
}

// MARK: - Widget Configuration
@main
struct ClipboardWidget: Widget {
    let kind = "ClipboardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClipboardProvider()) { entry in
            ClipboardWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("クリップボード履歴")
        .description("最近コピーした内容を表示します")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Preview
#Preview(as: .systemMedium) {
    ClipboardWidget()
} timeline: {
    ClipboardEntry(date: .now, items: [
        ClipboardItem(content: "サンプルテキスト１", usageCount: 5),
        ClipboardItem(content: "https://example.com", usageCount: 3),
        ClipboardItem(content: "Hello, World!", usageCount: 2)
    ])
}
