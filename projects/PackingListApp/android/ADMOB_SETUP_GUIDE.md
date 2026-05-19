# Google AdMob 設定ガイド

このアプリにはGoogle AdMobが統合されており、バナー広告で収益化が可能です。

## 📋 現在の実装状況

### ✅ 実装済み機能
- MainActivity（持ち物リスト一覧画面）にバナー広告
- ItemListActivity（持ち物一覧画面）にバナー広告
- ChecklistActivity（チェックリスト画面）にバナー広告
- 広告のライフサイクル管理（onPause、onResume、onDestroy）

### 広告の配置
各画面の下部に50dpのマージンを設けてバナー広告を表示しています。これにより：
- コンテンツが広告で隠れない
- ユーザー体験を損なわない
- 誤クリックを防ぐ

## 🚀 本番環境へのデプロイ手順

### 1. Google AdMobアカウントの作成

1. [Google AdMob](https://admob.google.com/)にアクセス
2. Googleアカウントでサインイン
3. 「アプリを追加」をクリック
4. プラットフォームで「Android」を選択
5. アプリ名を入力：「パッキングリスト」
6. アプリが作成されると、**App ID**が発行される
   - 形式：`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`

### 2. 広告ユニットの作成

1. AdMobコンソールで「広告ユニット」タブを選択
2. 「広告ユニットを作成」をクリック
3. 「バナー」を選択
4. 広告ユニット名を入力：「メイン画面バナー」
5. 「広告ユニットを作成」をクリック
6. **広告ユニットID**が発行される
   - 形式：`ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`

### 3. AndroidManifest.xmlの更新

`app/src/main/AndroidManifest.xml`を開き、以下の部分を更新：

```xml
<!-- テスト用App ID（現在） -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713" />

<!-- 本番用App IDに置き換え -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY" />
```

### 4. レイアウトファイルの更新

以下の3つのファイルで広告ユニットIDを更新：

#### activity_main.xml
```xml
<com.google.android.gms.ads.AdView
    android:id="@+id/adView"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_gravity="bottom"
    app:adSize="BANNER"
    app:adUnitId="ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ" />
```

#### activity_item_list.xml
```xml
<com.google.android.gms.ads.AdView
    android:id="@+id/adView"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_gravity="bottom"
    app:adSize="BANNER"
    app:adUnitId="ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ" />
```

#### activity_checklist.xml
```xml
<com.google.android.gms.ads.AdView
    android:id="@+id/adView"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_gravity="bottom"
    app:adSize="BANNER"
    app:adUnitId="ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ" />
```

### 5. テストデバイスの設定（開発中）

開発中は実際の広告をテストできますが、自分のデバイスをテストデバイスとして登録する必要があります。

#### テストデバイスIDの取得
1. アプリを実行
2. Android Studioの「Logcat」を開く
3. 「RequestConfiguration」で検索
4. 以下のようなログを探す：
   ```
   Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("33BE2250B43518CCDA7DE426D04EE231"))
   ```
5. デバイスIDをコピー

#### PackingListApplication.ktを更新
```kotlin
// テスト広告を有効にする
val configuration = RequestConfiguration.Builder()
    .setTestDeviceIds(listOf("YOUR_ACTUAL_TEST_DEVICE_ID"))  // ここに実際のIDを入力
    .build()
MobileAds.setRequestConfiguration(configuration)
```

### 6. アプリのリリース前の確認

- [ ] App IDを本番用に更新
- [ ] 広告ユニットIDを本番用に更新（全3箇所）
- [ ] テストデバイスIDの設定を削除または本番用に変更
- [ ] AdMobポリシーに準拠していることを確認
- [ ] 広告が正しく表示されることをテスト

## 💰 収益化のヒント

### 1. ユーザー数を増やす
- Google Play Storeでの最適化（ASO）
- SNSでのプロモーション
- ユーザーレビューの促進

### 2. エンゲージメントを高める
- アプリの使いやすさを向上
- 定期的な機能追加
- バグ修正とパフォーマンス改善

### 3. 広告の最適化
- 複数の広告フォーマットを試す
- 広告の配置を調整
- eCPM（実効CPM）をモニタリング

### 4. 追加の広告フォーマット（今後実装可能）

#### インタースティシャル広告
- 画面遷移時に全画面で表示
- クリック率が高い
- 収益性が高い

実装例：
```kotlin
val adRequest = AdRequest.Builder().build()
InterstitialAd.load(this, "ca-app-pub-xxx/yyy", adRequest, 
    object : InterstitialAdLoadCallback() {
        override fun onAdLoaded(interstitialAd: InterstitialAd) {
            interstitialAd.show(this@MainActivity)
        }
    }
)
```

#### リワード広告
- ユーザーに報酬を提供
- ユーザー満足度が高い
- エンゲージメント向上

実装例：
```kotlin
val adRequest = AdRequest.Builder().build()
RewardedAd.load(this, "ca-app-pub-xxx/yyy", adRequest,
    object : RewardedAdLoadCallback() {
        override fun onAdLoaded(rewardedAd: RewardedAd) {
            rewardedAd.show(this@MainActivity) { rewardItem ->
                // ユーザーに報酬を付与
            }
        }
    }
)
```

## ⚠️ 重要な注意事項

### AdMobポリシー違反に注意
- **自己クリック禁止**: 自分の広告をクリックしない
- **クリック誘導禁止**: 「広告をクリック」などの誘導文言を使わない
- **誤クリック防止**: 広告の配置に注意

### ポリシー違反の結果
- アカウント停止
- 収益の没収
- 再申請の困難

### 推奨事項
- [AdMobポリシー](https://support.google.com/admob/answer/6128543)を熟読
- 定期的にAdMobコンソールをチェック
- ユーザーフィードバックに注意

## 📊 収益のモニタリング

### AdMobコンソールで確認できる指標
- **インプレッション数**: 広告が表示された回数
- **クリック数**: 広告がクリックされた回数
- **CTR（クリック率）**: クリック数 ÷ インプレッション数
- **eCPM**: 1000インプレッションあたりの収益
- **収益**: 実際の収益額

### 支払いについて
- 最低支払額：$100（約10,000円〜15,000円）
- 支払い方法：銀行振込、小切手
- 支払いサイクル：月次

## 🔧 トラブルシューティング

### 広告が表示されない場合

1. **インターネット接続を確認**
   - デバイスがインターネットに接続されているか確認

2. **App IDとAdUnit IDを確認**
   - 正しいIDが設定されているか確認
   - タイプミスがないか確認

3. **Logcatでエラーを確認**
   ```
   adb logcat | grep "Ads"
   ```

4. **テスト広告IDを使用**
   - 開発中はテスト広告IDを使用
   - 本番用IDは審査が必要な場合がある

### よくあるエラー

**「Ad failed to load: 3」**
- ネットワークエラー
- インターネット接続を確認

**「Ad failed to load: 0」**
- 内部エラー
- AdMobの初期化を確認

**「Invalid Ad Unit ID」**
- 広告ユニットIDが間違っている
- IDを再確認

## 📚 参考リンク

- [Google AdMob公式サイト](https://admob.google.com/)
- [AdMob Android スタートガイド](https://developers.google.com/admob/android/quick-start)
- [AdMobポリシー](https://support.google.com/admob/answer/6128543)
- [AdMobヘルプセンター](https://support.google.com/admob)

## ライセンス

このガイドはサンプルアプリケーションの一部です。
