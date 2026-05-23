// apps/android/app/src/main/java/com/arpreview/ARCompanionApp.kt

package com.arpreview

import android.app.Application
import android.util.Log
import com.google.ar.core.ArCoreApk

class ARCompanionApp : Application() {

    override fun onCreate() {
        super.onCreate()
        checkARCore()
    }

    private fun checkARCore() {
        val availability = ArCoreApk.getInstance().checkAvailability(this)
        Log.i("ARCompanion", "ARCore availability: $availability")
    }
}
