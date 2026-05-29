# パッキングリストアプリ - ActiveRecordパターン版

旅行などの際の持ち物管理をサポートするAndroidアプリです。

## 特徴

このアプリは**ActiveRecordパターン**を採用しています。各モデルクラスが自身のデータベース操作メソッドを持ち、直感的で分かりやすいコード構造になっています。

## 機能

### 持ち物リスト管理
- ✅ 持ち物リストの作成、編集、削除
- ✅ 持ち物リスト名と説明の登録
- ✅ 複数の持ち物リストを管理

### 持ち物管理
- ✅ 持ち物の追加、編集、削除
- ✅ 持ち物の名前と数量の設定
- ✅ ドラッグ&ドロップで持ち物の順番を変更
- ✅ 持ち物リストに対して一対多の関係

### チェックリスト機能
- ✅ 予定と持ち物リストを紐付けてチェックリストを作成
- ✅ 各持ち物にチェックボックスを表示
- ✅ チェックの進捗を表示
- ✅ 持ち物リストごとにチェックリストの一覧を表示

### Googleカレンダー連携
- 🔄 Googleカレンダーから予定を取り込み（実装予定）
- 🔄 予定と持ち物リストを一対多で紐付け（実装予定）
- 🔄 予定からチェックリスト画面を表示（実装予定）

### ウィジェット機能
- ✅ ホーム画面に持ち物リスト一覧を表示
- ✅ 持ち物リスト一覧から持ち物を見るボタンで持ち物一覧を表示
- ✅ 持ち物リスト一覧からチェックリストボタンでチェックリスト一覧を表示
- ✅ チェックリスト一覧からチェック画面に遷移
- ✅ チェック画面で各持ち物をチェック可能
- ✅ 各画面に戻るボタンを配置し、前の画面に戻れる

### 広告機能
- ✅ Google AdMob統合
- ✅ 各画面下部にバナー広告を表示
- ✅ 収益化対応

## 技術スタック

- **言語**: Kotlin
- **UI**: Material Design 3
- **データベース**: SQLite (Room)
- **アーキテクチャ**: MVVM + **ActiveRecordパターン**
- **非同期処理**: Kotlin Coroutines + Flow
- **広告**: Google AdMob

## ActiveRecordパターンとは

ActiveRecordパターンでは、各モデルクラスが自身のCRUD操作メソッドを持ちます。これにより：

- **直感的なコード**: `packingList.save()`, `item.delete()` など自然な記述
- **簡潔な実装**: Repository層が不要で、コード量が削減
- **理解しやすい**: モデルとデータベース操作が一体化

### コード例

```kotlin
// 持ち物リストの作成
val packingList = PackingList.create("旅行用リスト", "3泊4日の旅行")

// 持ち物を追加
val item = packingList.addItem("歯ブラシ", 1)

// 持ち物を更新
item.name = "歯ブラシセット"
item.save()

// 全ての持ち物リストを取得
PackingList.findAll().observe(this) { lists ->
    // UI更新
}

// 持ち物リストを削除
packingList.delete()
```

## モデルクラスの構成

### PackingList（持ち物リスト）
```kotlin
class PackingList {
    companion object {
        fun findAll(): Flow<List<PackingList>>
        suspend fun findById(id: Long): PackingList?
        suspend fun create(name: String, description: String): PackingList
    }
    
    suspend fun save()
    suspend fun delete()
    fun items(): Flow<List<Item>>
    fun checklists(): Flow<List<Checklist>>
    suspend fun addItem(name: String, quantity: Int): Item
}
```

### Item（持ち物）
```kotlin
class Item {
    companion object {
        fun findByPackingListId(packingListId: Long): Flow<List<Item>>
        suspend fun findById(id: Long): Item?
        suspend fun create(packingListId: Long, name: String, quantity: Int): Item
        suspend fun updateAll(items: List<Item>>
    }
    
    suspend fun save()
    suspend fun delete()
    suspend fun packingList(): PackingList?
}
```

### Event（予定）
```kotlin
class Event {
    companion object {
        fun findAll(): Flow<List<Event>>
        suspend fun findById(id: String): Event?
        suspend fun create(...): Event
        suspend fun insertAll(events: List<Event>)
    }
    
    suspend fun save()
    suspend fun delete()
    fun packingLists(): Flow<List<PackingList>>
    suspend fun linkPackingList(packingListId: Long)
    suspend fun unlinkPackingList(packingListId: Long)
}
```

### Checklist（チェックリスト）
```kotlin
class Checklist {
    companion object {
        fun findByPackingListId(packingListId: Long): Flow<List<Checklist>>
        suspend fun findById(id: Long): Checklist?
        suspend fun create(eventId: String, packingListId: Long): Checklist
    }
    
    suspend fun save()
    suspend fun delete()
    suspend fun addChecklistItem(itemId: Long): ChecklistItem
    fun items(): Flow<List<ChecklistItemWithDetails>>
}
```

### ChecklistItem（チェックリストアイテム）
```kotlin
class ChecklistItem {
    companion object {
        fun findByChecklistId(checklistId: Long): Flow<List<ChecklistItem>>
        fun findByChecklistIdWithDetails(checklistId: Long): Flow<List<ChecklistItemWithDetails>>
        suspend fun create(checklistId: Long, itemId: Long): ChecklistItem
    }
    
    suspend fun save()
    suspend fun delete()
    suspend fun toggleCheck()
    suspend fun setChecked(checked: Boolean)
}
```

## データベース設計

### テーブル構成

- **packing_lists**: 持ち物リスト
- **items**: 持ち物
- **events**: 予定
- **event_packing_lists**: 予定と持ち物リストの関連（多対多）
- **checklists**: チェックリスト
- **checklist_items**: チェックリストアイテム

## ViewModelでの使用例

```kotlin
class MainViewModel : ViewModel() {
    // モデルから直接データを取得
    val packingLists = PackingList.findAll().asLiveData()

    fun insertPackingList(name: String, description: String) {
        viewModelScope.launch {
            // モデルのクラスメソッドで作成
            PackingList.create(name, description)
        }
    }

    fun updatePackingList(packingList: PackingList) {
        viewModelScope.launch {
            // インスタンスメソッドで保存
            packingList.save()
        }
    }

    fun deletePackingList(packingList: PackingList) {
        viewModelScope.launch {
            // インスタンスメソッドで削除
            packingList.delete()
        }
    }
}
```

## ビルド方法

### 必要な環境
- Android Studio Hedgehog (2023.1.1) 以降
- JDK 17以上
- Android SDK (API 26以上)
- Gradle 8.2

### ビルド手順

1. **プロジェクトを開く**
   ```bash
   # プロジェクトをAndroid Studioで開く
   # または
   cd PackingListApp
   ./gradlew build
   ```

2. **Gradleの同期**
   - Android Studioが自動的に同期を実行
   - または、メニューから「File」→「Sync Project with Gradle Files」

3. **アプリのビルド**
   - Android Studioの「Run」ボタンをクリック
   - または、コマンドラインから：
   ```bash
   ./gradlew assembleDebug
   ```

4. **APKの場所**
   - ビルドされたAPKは以下の場所に生成されます：
   ```
   app/build/outputs/apk/debug/app-debug.apk
   ```

### 最新のAndroid開発環境に対応

このプロジェクトは以下の最新の構成で作成されています：

#### Gradle設定の最新化
- **settings.gradle**: `dependencyResolutionManagement`を使用
- **build.gradle**: プロジェクトレベルのrepositories削除
- **app/build.gradle**: namespace定義、buildConfig有効化

#### 主要な変更点
```gradle
// settings.gradle
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

// app/build.gradle
android {
    namespace 'com.example.packinglist'
    buildFeatures {
        viewBinding true
        buildConfig true
    }
}
```

#### Gradle 8.2の新機能
- Configuration cache有効化
- Non-transitive R classes有効化
- 最新のKotlin 1.9.22対応

## 必要な権限

- `READ_CALENDAR`: Googleカレンダーの読み取り
- `INTERNET`: カレンダーAPIアクセス、広告表示
- `ACCESS_NETWORK_STATE`: ネットワーク状態の確認（広告用）
- `GET_ACCOUNTS`: Googleアカウント情報の取得

## 広告の設定

### テスト広告ID（デフォルト）
アプリには以下のテスト広告IDが設定されています：
- **App ID**: `ca-app-pub-3940256099942544~3347511713`
- **Banner Ad Unit ID**: `ca-app-pub-3940256099942544/6300978111`

### 本番環境への切り替え

1. **AdMobアカウントの作成**
   - [Google AdMob](https://admob.google.com/)にアクセス
   - アカウントを作成し、新しいアプリを登録

2. **広告ユニットの作成**
   - AdMobコンソールで「広告ユニット」を作成
   - 「バナー」タイプを選択
   - 広告ユニットIDをコピー

3. **AndroidManifest.xmlを更新**
   ```xml
   <!-- 本番用のApp IDに置き換え -->
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY" />
   ```

4. **レイアウトファイルを更新**
   各レイアウトファイル（activity_main.xml、activity_item_list.xml、activity_checklist.xml）の広告ユニットIDを更新：
   ```xml
   <com.google.android.gms.ads.AdView
       ...
       app:adUnitId="ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ" />
   ```

5. **テストデバイスの設定（オプション）**
   PackingListApplication.ktで実際のテストデバイスIDを設定：
   ```kotlin
   val configuration = RequestConfiguration.Builder()
       .setTestDeviceIds(listOf("YOUR_TEST_DEVICE_ID"))
       .build()
   ```

### テストデバイスIDの取得方法
1. アプリを実行
2. Logcatで「Use RequestConfiguration.Builder().setTestDeviceIds」を検索
3. ログに表示されたデバイスIDをコピー

## 使い方

### 1. 持ち物リストの作成
1. メイン画面の「+」ボタンをタップ
2. リスト名と説明を入力
3. 「保存」をタップ

### 2. 持ち物の追加
1. 持ち物リストをタップして開く
2. 「+」ボタンをタップ
3. 持ち物名と数量を入力
4. 「保存」をタップ

### 3. 持ち物の順番変更
1. ドラッグハンドル（三本線アイコン）を長押し
2. 希望の位置までドラッグ

### 4. チェックリストの利用
1. 予定と持ち物リストを紐付け（実装予定）
2. チェックリスト画面を開く
3. 持ち物を確認しながらチェック

### 5. ウィジェットの追加と使用
1. ホーム画面を長押し
2. 「ウィジェット」を選択
3. 「パッキングリスト」ウィジェットを選択してホーム画面に配置
4. ウィジェット上で持ち物リストの確認やチェックが可能

#### ウィジェットの操作方法
- **持ち物を見るボタン**: タップすると持ち物一覧が表示される
- **チェックリストボタン**: タップするとチェックリスト一覧が表示される
- **チェックリスト一覧**: 各チェックリストの「チェックする」ボタンでチェック画面へ
- **チェック画面**: チェックボックスをタップして持ち物をチェック
- **戻るボタン**: 各画面の左上の矢印ボタンで前の画面に戻る
- **更新ボタン**: メイン画面の更新ボタンでデータを再読み込み

## ActiveRecordパターンの利点と注意点

### 利点
- コードが直感的で読みやすい
- Repository層が不要でシンプル
- モデル中心の設計
- テストが書きやすい

### 注意点
- モデルがデータベースに依存
- 複雑なクエリは別途DAOを使用
- データベース初期化が必要

## 今後の実装予定

- [ ] Googleカレンダー連携機能
- [ ] 予定と持ち物リストの紐付け画面
- [ ] 予定一覧からチェックリストへの遷移
- [ ] チェックリストの削除機能
- [ ] データのバックアップ/復元機能
- [ ] 持ち物のテンプレート機能
- [ ] インタースティシャル広告の追加
- [ ] リワード広告の追加

## 広告に関する重要な注意事項

### ポリシー遵守
- Google AdMobの[ポリシー](https://support.google.com/admob/answer/6128543)を必ず確認してください
- 不正なクリックや自己クリックは厳禁です
- アプリの品質とユーザー体験を損なわないよう配慮してください

### 収益化のベストプラクティス
1. **広告の配置**
   - 現在は各画面下部にバナー広告を配置
   - ユーザー体験を損なわない位置に配置

2. **広告の種類**
   - **バナー広告**: 画面下部に常時表示（実装済み）
   - **インタースティシャル広告**: 画面遷移時に表示（今後実装可能）
   - **リワード広告**: 特典と引き換えに表示（今後実装可能）

3. **収益向上のヒント**
   - アプリのダウンロード数を増やす
   - ユーザーのエンゲージメントを高める
   - 広告の配置を最適化する
   - 複数の広告フォーマットを組み合わせる

## ライセンス

このプロジェクトはサンプルアプリケーションです。

## 広告の設定（本番環境用）

現在、テスト用の広告IDが設定されています。本番環境にリリースする際は、以下の手順で実際の広告IDに置き換えてください：

### 1. AdMob アカウントの作成
1. [Google AdMob](https://admob.google.com/)にアクセス
2. アカウントを作成
3. 新しいアプリを追加

### 2. 広告ユニットの作成
1. AdMobコンソールで「広告ユニット」を作成
2. 「バナー広告」を選択
3. 広告ユニットIDをコピー

### 3. アプリに広告IDを設定

#### AndroidManifest.xml
```xml
<!-- テスト用ID -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>

<!-- 実際のApp IDに置き換え -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

#### レイアウトファイル (activity_main.xml, activity_item_list.xml, activity_checklist.xml)
```xml
<!-- テスト用広告ユニットID -->
ads:adUnitId="ca-app-pub-3940256099942544/6300978111"

<!-- 実際の広告ユニットIDに置き換え -->
ads:adUnitId="ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ"
```

### 4. テストデバイスの設定（開発中）

`PackingListApplication.kt`で、実際のテストデバイスIDを設定してください：

```kotlin
val configuration = RequestConfiguration.Builder()
    .setTestDeviceIds(listOf("YOUR_TEST_DEVICE_ID"))
    .build()
```

デバイスIDは、Logcatで確認できます。

### 注意事項
- **テスト広告を使用せずに本番広告を開発中にクリックすると、AdMobアカウントが停止される可能性があります**
- 本番環境にリリースする前に、必ず実際の広告IDに置き換えてください
- テストデバイスでの動作確認を十分に行ってください
