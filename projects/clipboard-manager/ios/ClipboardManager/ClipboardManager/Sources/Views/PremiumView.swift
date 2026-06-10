import SwiftUI
import StoreKit

struct PremiumView: View {
    @ObservedObject var store: StoreManager
    @Environment(\.dismiss) var dismiss
    @State private var isPurchasing = false
    @State private var errorMessage: String?

    let features: [(String, String)] = [
        ("nosign", "広告なし"),
        ("infinity", "無制限の履歴保存"),
        ("magnifyingglass", "高度な検索"),
        ("paintpalette", "テーマカスタマイズ"),
        ("star.fill", "優先サポート")
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Hero
                    VStack(spacing: 12) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 64)).foregroundColor(.yellow)
                        Text("プレミアムにアップグレード")
                            .font(.title2).fontWeight(.bold)
                        Text("広告なし・無制限の履歴・高度な機能")
                            .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center)
                    }
                    .padding(.top, 32)

                    // Features
                    VStack(spacing: 12) {
                        ForEach(features, id: \.0) { icon, text in
                            HStack(spacing: 16) {
                                Image(systemName: icon).font(.title3).foregroundColor(.blue).frame(width: 28)
                                Text(text).font(.body)
                                Spacer()
                                Image(systemName: "checkmark").foregroundColor(.green)
                            }
                            .padding(14).background(Color(.systemGray6)).cornerRadius(12)
                        }
                    }
                    .padding(.horizontal)

                    // Plans
                    VStack(spacing: 12) {
                        if let monthly = store.monthlyProduct {
                            PlanCard(product: monthly, isPurchasing: isPurchasing) { purchase(monthly) }
                        }
                        if let yearly = store.yearlyProduct {
                            PlanCard(product: yearly, badge: "2ヶ月分お得", isPurchasing: isPurchasing) { purchase(yearly) }
                        }
                        if store.products.isEmpty {
                            // products未ロード時のフォールバック
                            PlanCardFallback(title: "月額プラン", price: "¥300/月", isPurchasing: isPurchasing) {}
                            PlanCardFallback(title: "年額プラン", price: "¥2,400/年", badge: "2ヶ月分お得", isPurchasing: isPurchasing) {}
                        }
                    }
                    .padding(.horizontal)

                    if let error = errorMessage {
                        Text(error).font(.caption).foregroundColor(.red).padding(.horizontal)
                    }

                    Button("購入を復元") { restorePurchases() }
                        .font(.footnote).foregroundColor(.blue).disabled(isPurchasing)

                    HStack(spacing: 20) {
                        Button("利用規約") {}.font(.caption).foregroundColor(.gray)
                        Button("プライバシーポリシー") {}.font(.caption).foregroundColor(.gray)
                    }
                    .padding(.bottom, 32)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("閉じる") { dismiss() } } }
        }
    }

    private func purchase(_ product: Product) {
        guard !isPurchasing else { return }
        isPurchasing = true; errorMessage = nil
        Task {
            do {
                let tx = try await store.purchase(product)
                if tx != nil { dismiss() }
            } catch { errorMessage = error.localizedDescription }
            isPurchasing = false
        }
    }

    private func restorePurchases() {
        isPurchasing = true
        Task {
            await store.restorePurchases()
            isPurchasing = false
            if store.isPremium { dismiss() }
        }
    }
}

struct PlanCard: View {
    let product: Product
    var badge: String? = nil
    let isPurchasing: Bool
    let onPurchase: () -> Void

    var body: some View {
        Button(action: onPurchase) {
            ZStack(alignment: .topTrailing) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(product.displayName).font(.headline)
                        Text(product.description).font(.caption).foregroundColor(.gray)
                    }
                    Spacer()
                    Text(product.displayPrice).font(.title3).fontWeight(.bold).foregroundColor(.blue)
                }
                .padding(16).background(Color.blue.opacity(0.08))
                .cornerRadius(14).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.blue, lineWidth: 1.5))
                if let badge = badge {
                    Text(badge).font(.caption2).fontWeight(.bold).foregroundColor(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3).background(Color.orange).cornerRadius(8)
                        .offset(x: -8, y: -8)
                }
            }
        }
        .disabled(isPurchasing).opacity(isPurchasing ? 0.6 : 1)
    }
}

struct PlanCardFallback: View {
    let title: String; let price: String; var badge: String? = nil
    let isPurchasing: Bool; let onPurchase: () -> Void

    var body: some View {
        Button(action: onPurchase) {
            ZStack(alignment: .topTrailing) {
                HStack {
                    Text(title).font(.headline); Spacer()
                    Text(price).font(.title3).fontWeight(.bold).foregroundColor(.blue)
                }
                .padding(16).background(Color.blue.opacity(0.08))
                .cornerRadius(14).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.blue, lineWidth: 1.5))
                if let badge = badge {
                    Text(badge).font(.caption2).fontWeight(.bold).foregroundColor(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3).background(Color.orange).cornerRadius(8)
                        .offset(x: -8, y: -8)
                }
            }
        }
        .disabled(isPurchasing)
    }
}
