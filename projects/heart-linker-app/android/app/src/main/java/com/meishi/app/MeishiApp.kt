package com.meishi.app

import android.app.Application
import com.meishi.app.db.MeishiDatabase

class MeishiApp : Application() {
    lateinit var database: MeishiDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        database = MeishiDatabase.getInstance(this)
    }

    companion object {
        lateinit var instance: MeishiApp
            private set
    }
}
