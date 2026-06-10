import Foundation
import Combine

class ClipboardViewModel: ObservableObject {
    @Published var filteredItems: [ClipboardItem] = []
    @Published var searchQuery: String = "" { didSet { refreshItems() } }
    @Published var sortBy: SortOption = .lastUsedAt { didSet { refreshItems() } }
    @Published var ascending: Bool = false { didSet { refreshItems() } }
    @Published var selectedIds: Set<UUID> = []
    @Published var isSelectionMode: Bool = false

    private let dataManager = ClipboardDataManager.shared
    private let monitor = ClipboardMonitorService.shared
    private var cancellables = Set<AnyCancellable>()

    init() {
        dataManager.$items.sink { [weak self] _ in self?.refreshItems() }.store(in: &cancellables)
        monitor.startMonitoring()
        refreshItems()
    }

    private func refreshItems() {
        filteredItems = dataManager.getFiltered(query: searchQuery, sortBy: sortBy, ascending: ascending)
    }

    func updateSort(_ option: SortOption) {
        if sortBy == option { ascending.toggle() } else { sortBy = option; ascending = false }
    }

    func copyToClipboard(_ item: ClipboardItem) { monitor.copyToClipboard(item.content) }

    func toggleSelectionMode() {
        isSelectionMode.toggle()
        if !isSelectionMode { selectedIds.removeAll() }
    }

    func toggleSelection(_ id: UUID) {
        if selectedIds.contains(id) { selectedIds.remove(id) } else { selectedIds.insert(id) }
    }

    func deleteSelected() {
        dataManager.delete(ids: selectedIds)
        selectedIds.removeAll()
        isSelectionMode = false
    }
}
