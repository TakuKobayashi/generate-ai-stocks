import SwiftUI

@main
struct ClipboardManagerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // AdMob初期化 (本番環境でGoogle Mobile Ads SDKを使用する場合)
        // GADMobileAds.sharedInstance().start(completionHandler: nil)
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        ClipboardMonitorService.shared.stopMonitoring()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        ClipboardMonitorService.shared.startMonitoring()
    }
}
