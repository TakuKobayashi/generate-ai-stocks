package com.example.nomikai.di

import android.content.Context
import com.example.nomikai.data.api.ApiClient
import com.example.nomikai.data.api.NomikaiApiService
import com.example.nomikai.data.db.DatabaseHolder
import com.example.nomikai.data.db.NomikaiDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    /**
     * Room DB を生成し、DatabaseHolder に登録する。
     * ActiveRecord の各クラスは DatabaseHolder.db 経由でDAOにアクセスする。
     */
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): NomikaiDatabase {
        val db = NomikaiDatabase.create(context)
        DatabaseHolder.initialize(db)
        return db
    }

    @Provides
    @Singleton
    fun provideApiService(): NomikaiApiService = ApiClient.apiService
}
