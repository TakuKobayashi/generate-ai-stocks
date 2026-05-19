# パッキングリストアプリ - プロジェクト概要（ActiveRecordパターン版）

## アプリケーション概要

旅行などの際に必要な持ち物を管理し、チェックリストとして利用できるAndroidネイティブアプリケーションです。Material Design 3を採用した美しいUIと、ActiveRecordパターンによる直感的なデータ管理を実現しています。

## ActiveRecordパターンの採用

このプロジェクトでは、**ActiveRecordパターン**を採用しています。従来のDAO + Repositoryパターンとは異なり、各モデルクラスが自身のデータベース操作メソッドを持つことで、よりシンプルで直感的なコード構造を実現しています。

### ActiveRecordパターンの特徴

1. **モデル中心の設計**
   - 各モデルクラスが自身のCRUD操作を管理
   - ビジネスロジックとデータアクセスが統合

2. **直感的なAPI**
   ```kotlin
   // 作成
   val list = PackingList.create("旅行", "3泊4日")
   
   // 更新
   list.name = "出張"
   list.save()
   
   // 削除
   list.delete()
   
   // 検索
   val allLists = PackingList.findAll()
   val specificList = PackingList.findById(1)
   ```

3. **関連の直感的な取得**
   ```kotlin
   // 持ち物リストの持ち物を取得
   val items = packingList.items()
   
   // 持ち物が属する持ち物リストを取得
   val list = item.packingList()
   
   // 予定に紐付けられた持ち物リスト
   val lists = event.packingLists()
   ```

## 主要機能

### 1. 持ち物リスト管理
- 持ち物リストの作成、編集、削除
- リスト名と説明の設定
- 複数のリストを管理可能

### 2. 持ち物管理
- 持ち物の追加、編集、削除
- 持ち物名と数量の設定
- ドラッグ&ドロップによる順番の変更

### 3. チェックリスト機能
- 予定と持ち物リストを紐付けてチェックリストを作成
- チェック進捗の可視化

### 4. Googleカレンダー連携（実装予定）
- Googleカレンダーから予定を取り込み
- 予定と持ち物リストの紐付け

## 技術仕様

### アーキテクチャ
- **設計パターン**: MVVM + **ActiveRecord**
- **言語**: Kotlin
- **最小SDKバージョン**: API 26 (Android 8.0)
- **ターゲットSDKバージョン**: API 34 (Android 14)

### 主要ライブラリ
- **UI**: Material Design 3
- **データベース**: Room (SQLite)
- **非同期処理**: Kotlin Coroutines + Flow
- **ビュー管理**: ViewBinding
- **ライフサイクル**: AndroidX Lifecycle

## プロジェクト構造

```
app/src/main/
├── java/com/example/packinglist/
│   ├── model/               # ActiveRecordモデル
│   │   ├── PackingList.kt   # 持ち物リストモデル + DAO
│   │   ├── Item.kt          # 持ち物モデル + DAO
│   │   ├── Event.kt         # 予定モデル + DAO
│   │   ├── EventPackingList.kt
│   │   ├── Checklist.kt     # チェックリストモデル + DAO
│   │   └── ChecklistItem.kt # チェックリストアイテムモデル + DAO
│   ├── data/
│   │   └── AppDatabase.kt   # データベース設定
│   ├── ui/
│   │   ├── adapter/         # RecyclerViewアダプター
│   │   ├── viewmodel/       # ビューモデル
│   │   ├── MainActivity.kt
│   │   ├── ItemListActivity.kt
│   │   ├── ChecklistActivity.kt
│   │   └── EventListActivity.kt
│   └── PackingListApplication.kt
```

## モデルクラスの詳細

### PackingList.kt
```kotlin
@Entity(tableName = "packing_lists")
data class PackingList(...) {
    companion object {
        // クラスメソッド（静的）
        fun findAll(): Flow<List<PackingList>>
        suspend fun findById(id: Long): PackingList?
        suspend fun create(name: String, description: String): PackingList
    }
    
    // インスタンスメソッド
    suspend fun save()
    suspend fun delete()
    fun items(): Flow<List<Item>>
    fun checklists(): Flow<List<Checklist>>
    suspend fun addItem(name: String, quantity: Int): Item
}

@Dao
interface PackingListDao {
    @Query("SELECT * FROM packing_lists ORDER BY updatedAt DESC")
    fun findAll(): Flow<List<PackingList>>
    
    @Query("SELECT * FROM packing_lists WHERE id = :id")
    suspend fun findById(id: Long): PackingList?
    
    @Insert
    suspend fun insert(packingList: PackingList): Long
    
    @Update
    suspend fun update(packingList: PackingList)
    
    @Delete
    suspend fun delete(packingList: PackingList)
}
```

同様のパターンで、Item、Event、Checklist、ChecklistItemもモデル+DAO一体型で実装されています。

## ViewModelの実装例

```kotlin
class MainViewModel : ViewModel() {
    // モデルから直接取得
    val packingLists = PackingList.findAll().asLiveData()

    fun insertPackingList(name: String, description: String) {
        viewModelScope.launch {
            PackingList.create(name, description)
        }
    }

    fun updatePackingList(packingList: PackingList) {
        viewModelScope.launch {
            packingList.save()
        }
    }

    fun deletePackingList(packingList: PackingList) {
        viewModelScope.launch {
            packingList.delete()
        }
    }
}
```

## データベース設計

### エンティティ関係図

```
PackingList (持ち物リスト)
    ↓ 1:N
Item (持ち物)

Event (予定)
    ↓ M:N
PackingList (持ち物リスト)

Event + PackingList
    ↓ 1:1
Checklist (チェックリスト)
    ↓ 1:N
ChecklistItem (チェックアイテム)
```

## ActiveRecordパターンのメリット

### 1. コードの簡潔性
```kotlin
// DAO + Repositoryパターン
val repository = PackingListRepository(dao)
repository.insertPackingList(PackingList(...))

// ActiveRecordパターン
PackingList.create("リスト名", "説明")
```

### 2. 直感的な関連取得
```kotlin
// DAO + Repositoryパターン
val items = itemRepository.getItemsByPackingListId(packingList.id)

// ActiveRecordパターン
val items = packingList.items()
```

### 3. メソッドの自然な配置
```kotlin
// オブジェクトに対する操作がメソッドとして提供される
packingList.save()      // 保存
packingList.delete()    // 削除
packingList.addItem()   // アイテム追加
```

## デザイン

### カラースキーム
Material Design 3のグリーン系カラー:
- Primary: #006C4C
- Secondary: #4D6357
- Surface: #FBFDF8

### UI特徴
- Card-based デザイン
- Floating Action Button
- プログレスバー
- ドラッグハンドル

## セットアップ手順

1. Android Studio をインストール
2. プロジェクトをクローンまたはダウンロード
3. Android Studio でプロジェクトを開く
4. Gradle の同期を実行
5. エミュレータまたは実機で実行

## 今後の開発予定

- [ ] Googleカレンダー連携の実装
- [ ] 予定と持ち物リストの紐付け画面
- [ ] 予定一覧画面の実装
- [ ] チェックリスト削除機能
- [ ] データのエクスポート/インポート
- [ ] 持ち物テンプレート機能

## ライセンス

このプロジェクトはサンプル実装です。
