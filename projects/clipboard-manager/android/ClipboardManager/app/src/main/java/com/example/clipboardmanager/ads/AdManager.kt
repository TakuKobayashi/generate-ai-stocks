package com.example.clipboardmanager.ads

import android.app.Activity
import android.content.Context
import android.util.Log
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

class AdManager(private val context: Context) {
    companion object {
        // テスト用広告ID (本番では実際のIDに置き換える)
        const val BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/6300978111"
        const val INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712"
        private const val TAG = "AdManager"
        private const val INTERSTITIAL_FREQUENCY = 5

        @Volatile private var instance: AdManager? = null
        fun getInstance(context: Context): AdManager =
            instance ?: synchronized(this) { instance ?: AdManager(context.applicationContext).also { instance = it } }
    }

    private var interstitialAd: InterstitialAd? = null
    private var counter = 0

    init {
        MobileAds.initialize(context) { Log.d(TAG, "AdMob initialized") }
        loadInterstitialAd()
    }

    fun createBannerAdView(): AdView = AdView(context).apply {
        adUnitId = BANNER_AD_UNIT_ID
        setAdSize(AdSize.BANNER)
        loadAd(AdRequest.Builder().build())
    }

    private fun loadInterstitialAd() {
        InterstitialAd.load(context, INTERSTITIAL_AD_UNIT_ID, AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            interstitialAd = null
                            loadInterstitialAd()
                        }
                    }
                }
                override fun onAdFailedToLoad(error: LoadAdError) {
                    Log.e(TAG, "Failed to load interstitial: ${error.message}")
                }
            })
    }

    fun showInterstitialAdIfReady(activity: Activity) {
        if (++counter >= INTERSTITIAL_FREQUENCY) {
            counter = 0
            interstitialAd?.show(activity) ?: loadInterstitialAd()
        }
    }
}
