package com.example.ais.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Room
import com.example.ais.data.dao.GoalDao
import com.example.ais.data.dao.InterventionLogDao
import com.example.ais.data.db.AISDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "app_settings")

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): AISDatabase =
        Room.databaseBuilder(ctx, AISDatabase::class.java, AISDatabase.DATABASE_NAME)
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideGoalDao(db: AISDatabase): GoalDao = db.goalDao()

    @Provides
    fun provideInterventionLogDao(db: AISDatabase): InterventionLogDao = db.interventionLogDao()

    @Provides
    @Singleton
    fun provideDataStore(@ApplicationContext ctx: Context): DataStore<Preferences> =
        ctx.dataStore
}
