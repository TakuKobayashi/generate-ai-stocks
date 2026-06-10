package com.example.clipboardmanager.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

sealed class PurchaseState {
    object Idle : PurchaseState()
    object Purchasing : PurchaseState()
    object Success : PurchaseState()
    object Cancelled : PurchaseState()
    data class Error(val message: String) : PurchaseState()
}

class PremiumManager(private val context: Context) : PurchasesUpdatedListener {
    private var billingClient: BillingClient
    private val _isPremium = MutableStateFlow(false)
    val isPremium: StateFlow<Boolean> = _isPremium
    private val _purchaseState = MutableStateFlow<PurchaseState>(PurchaseState.Idle)
    val purchaseState: StateFlow<PurchaseState> = _purchaseState
    private var products: List<ProductDetails> = emptyList()

    companion object {
        const val MONTHLY_SUBSCRIPTION = "premium_monthly"
        const val YEARLY_SUBSCRIPTION = "premium_yearly"

        @Volatile private var instance: PremiumManager? = null
        fun getInstance(context: Context): PremiumManager =
            instance ?: synchronized(this) { instance ?: PremiumManager(context.applicationContext).also { instance = it } }
    }

    init {
        billingClient = BillingClient.newBuilder(context).setListener(this).enablePendingPurchases().build()
        startConnection()
    }

    private fun startConnection() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    CoroutineScope(Dispatchers.IO).launch { queryPurchases(); queryProducts() }
                }
            }
            override fun onBillingServiceDisconnected() { startConnection() }
        })
    }

    private suspend fun queryPurchases() {
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        val result = billingClient.queryPurchasesAsync(params)
        val hasPremium = result.purchasesList.any {
            (it.products.contains(MONTHLY_SUBSCRIPTION) || it.products.contains(YEARLY_SUBSCRIPTION)) &&
            it.purchaseState == Purchase.PurchaseState.PURCHASED
        }
        _isPremium.value = hasPremium
        result.purchasesList.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED && !it.isAcknowledged }
            .forEach { acknowledgePurchase(it) }
    }

    private fun queryProducts() {
        val list = listOf(MONTHLY_SUBSCRIPTION, YEARLY_SUBSCRIPTION).map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.SUBS).build()
        }
        billingClient.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build()) { result, details ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) products = details
        }
    }

    fun launchPurchaseFlow(activity: Activity, productId: String) {
        val product = products.firstOrNull { it.productId == productId } ?: run {
            _purchaseState.value = PurchaseState.Error("Product not found"); return
        }
        val offerToken = product.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: run {
            _purchaseState.value = PurchaseState.Error("No offer available"); return
        }
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(
            listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offerToken).build())
        ).build()
        _purchaseState.value = PurchaseState.Purchasing
        billingClient.launchBillingFlow(activity, params)
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        if (!purchase.isAcknowledged) acknowledgePurchase(purchase)
                        _isPremium.value = true
                        _purchaseState.value = PurchaseState.Success
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> _purchaseState.value = PurchaseState.Cancelled
            else -> _purchaseState.value = PurchaseState.Error(result.debugMessage)
        }
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        CoroutineScope(Dispatchers.IO).launch {
            billingClient.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()) { result ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) _isPremium.value = true
            }
        }
    }

    fun restorePurchases() { CoroutineScope(Dispatchers.IO).launch { queryPurchases() } }
    fun cleanup() { billingClient.endConnection() }
}
