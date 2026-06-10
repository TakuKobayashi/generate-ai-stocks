import StoreKit
import SwiftUI

@MainActor
class StoreManager: ObservableObject {
    static let shared = StoreManager()
    @Published private(set) var products: [Product] = []
    @Published private(set) var isPremium: Bool = false

    private let productIds: Set<String> = [
        "com.example.clipboardmanager.premium.monthly",
        "com.example.clipboardmanager.premium.yearly"
    ]
    private var updateTask: Task<Void, Error>?

    private init() {
        updateTask = listenForTransactions()
        Task { await loadProducts(); await updatePurchasedProducts() }
    }

    deinit { updateTask?.cancel() }

    func loadProducts() async {
        do { products = try await Product.products(for: productIds).sorted { $0.price < $1.price } }
        catch { print("Failed to load products: \(error)") }
    }

    func purchase(_ product: Product) async throws -> Transaction? {
        let result = try await product.purchase()
        switch result {
        case .success(let v):
            let tx = try checkVerified(v)
            await updatePurchasedProducts()
            await tx.finish()
            return tx
        default: return nil
        }
    }

    func restorePurchases() async {
        try? await AppStore.sync()
        await updatePurchasedProducts()
    }

    func updatePurchasedProducts() async {
        var purchased = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.revocationDate == nil { purchased = true }
        }
        isPremium = purchased
    }

    private func listenForTransactions() -> Task<Void, Error> {
        Task.detached {
            for await result in Transaction.updates {
                if case .verified(let tx) = result {
                    await self.updatePurchasedProducts()
                    await tx.finish()
                }
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        guard case .verified(let v) = result else { throw StoreError.failedVerification }
        return v
    }

    var monthlyProduct: Product? { products.first { $0.id.contains("monthly") } }
    var yearlyProduct: Product? { products.first { $0.id.contains("yearly") } }
}

enum StoreError: Error { case failedVerification }
