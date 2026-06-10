import SwiftUI
import UIKit

// Google Mobile Ads SDKがない環境向けのダミー実装
// 本番では pod 'Google-Mobile-Ads-SDK' を追加してください
struct BannerAdView: View {
    var body: some View {
        ZStack {
            Color(.systemGray5)
            VStack(spacing: 2) {
                Text("広告")
                    .font(.caption2)
                    .foregroundColor(.gray)
                Text("AdMob Banner — 本番では実際の広告が表示されます")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
            }
            .padding(4)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 50)
        .cornerRadius(4)
    }
}

// AdMobが導入された際はこちらを使用:
// import GoogleMobileAds
// struct BannerAdView: UIViewRepresentable {
//     func makeUIView(context: Context) -> GADBannerView {
//         let view = GADBannerView(adSize: GADAdSizeBanner)
//         view.adUnitID = "ca-app-pub-3940256099942544/2934735716"
//         view.rootViewController = UIApplication.shared.connectedScenes
//             .compactMap { $0 as? UIWindowScene }.first?.windows.first?.rootViewController
//         view.load(GADRequest())
//         return view
//     }
//     func updateUIView(_ uiView: GADBannerView, context: Context) {}
// }
