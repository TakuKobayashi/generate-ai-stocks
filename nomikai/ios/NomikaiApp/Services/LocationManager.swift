import Foundation
import CoreLocation
import Combine

// ─────────────────────────────────────────────────────────────────────────
//  LocationManager
//  CLLocationManager を SwiftUI から使えるよう ObservableObject でラップする。
//  HomeView / CreateInviteFormViewModel から @StateObject / @ObservedObject で使う。
// ─────────────────────────────────────────────────────────────────────────

final class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var coordinate: CLLocationCoordinate2D?
    @Published var authStatus: CLAuthorizationStatus = .notDetermined
    @Published var error: String?

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate         = self
        manager.desiredAccuracy  = kCLLocationAccuracyHundredMeters
        authStatus               = manager.authorizationStatus
        // 既に許可済みなら即座に取得
        if authStatus == .authorizedWhenInUse || authStatus == .authorizedAlways {
            manager.requestLocation()
        }
    }

    // ─── 公開メソッド ─────────────────────────────────────────────────

    /// 許可をリクエストし、許可されていれば位置情報を取得する。
    func requestLocation() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            error = "設定 > プライバシー > 位置情報サービスから許可してください"
        @unknown default:
            break
        }
    }

    // ─── CLLocationManagerDelegate ────────────────────────────────────

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        coordinate = locations.last?.coordinate
        error = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        self.error = error.localizedDescription
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authStatus = manager.authorizationStatus
        if authStatus == .authorizedWhenInUse || authStatus == .authorizedAlways {
            manager.requestLocation()
        }
    }
}
