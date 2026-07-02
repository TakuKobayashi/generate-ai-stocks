import SwiftUI

@main
struct MeishiApp: App {
    init() {
        // DB初期化(シングルトン起動)
        _ = Database.shared
    }
    var body: some Scene {
        WindowGroup {
            ContactListView()
        }
    }
}
