package com.example.nomikai.data.db

/**
 * ActiveRecordの各クラスがDBにアクセスするためのシングルトンホルダー。
 * Application#onCreate() または HiltModule で一度だけ初期化する。
 */
object DatabaseHolder {
    private var _db: NomikaiDatabase? = null

    val db: NomikaiDatabase
        get() = _db ?: error("DatabaseHolder が初期化されていません。AppModule で initialize() を呼び出してください。")

    fun initialize(database: NomikaiDatabase) {
        _db = database
    }
}
