import UIKit
import Combine

class ClipboardMonitorService: ObservableObject {
    static let shared = ClipboardMonitorService()
    private var lastContent: String?
    private var timer: Timer?
    private let dataManager = ClipboardDataManager.shared

    private init() {}

    func startMonitoring() {
        lastContent = UIPasteboard.general.string
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.checkClipboard()
        }
    }

    func stopMonitoring() { timer?.invalidate(); timer = nil }

    private func checkClipboard() {
        guard let content = UIPasteboard.general.string, !content.isEmpty, content != lastContent else { return }
        lastContent = content
        dataManager.insertOrUpdate(content: content)
    }

    func copyToClipboard(_ content: String) {
        UIPasteboard.general.string = content
        lastContent = content
        dataManager.insertOrUpdate(content: content)
    }
}
