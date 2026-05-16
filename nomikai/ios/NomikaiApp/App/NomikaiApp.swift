import SwiftUI
import GoogleMaps

// AppDelegate を使うため @UIApplicationDelegateAdaptor を指定
@main
struct NomikaiApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        // Google Maps SDK 初期化（Info.plist から API キーを読み込む）
        if let apiKey = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String {
            GMSServices.provideAPIKey(apiKey)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
