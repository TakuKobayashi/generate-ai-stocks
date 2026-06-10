package com.example.clipboardmanager.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.example.clipboardmanager.MainActivity
import com.example.clipboardmanager.R
import com.example.clipboardmanager.data.AppDatabase
import kotlinx.coroutines.*

class ClipboardWidgetProvider : AppWidgetProvider() {
    companion object {
        const val ACTION_COPY_ITEM = "com.example.clipboardmanager.ACTION_COPY_ITEM"
        const val EXTRA_CONTENT = "clipboard_content"
    }

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(context, mgr, it) }
    }

    private fun updateWidget(context: Context, mgr: AppWidgetManager, id: Int) {
        val views = RemoteViews(context.packageName, R.layout.clipboard_widget)
        val launchIntent = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        views.setOnClickPendingIntent(R.id.widget_title, launchIntent)

        val serviceIntent = Intent(context, ClipboardWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        }
        views.setRemoteAdapter(R.id.clipboard_list, serviceIntent)

        val clickIntent = Intent(context, ClipboardWidgetProvider::class.java).apply { action = ACTION_COPY_ITEM }
        views.setPendingIntentTemplate(R.id.clipboard_list,
            PendingIntent.getBroadcast(context, 0, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE))
        mgr.updateAppWidget(id, views)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_COPY_ITEM) {
            val content = intent.getStringExtra(EXTRA_CONTENT) ?: return
            (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                .setPrimaryClip(ClipData.newPlainText("clipboard", content))
            CoroutineScope(Dispatchers.IO).launch { AppDatabase.getDatabase(context).clipboardDao().insertOrUpdate(content) }
        }
    }
}
