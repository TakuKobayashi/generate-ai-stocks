package com.example.packinglist

import android.app.Application
import com.example.packinglist.data.AppDatabase
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration

class PackingListApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // データベースを初期化
        AppDatabase.getDatabase(this)
        
        // AdMobを初期化
        MobileAds.initialize(this) {}
        
        // テスト広告を有効にする（本番環境ではこの行を削除）
        val configuration = RequestConfiguration.Builder()
            .setTestDeviceIds(listOf("ABCDEF012345")) // 実際のテストデバイスIDに置き換えてください
            .build()
        MobileAds.setRequestConfiguration(configuration)
    }
}
