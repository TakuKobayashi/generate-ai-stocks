package com.example.clipboardmanager.widget

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.clipboardmanager.R
import com.example.clipboardmanager.data.AppDatabase
import com.example.clipboardmanager.data.ClipboardItem
import kotlinx.coroutines.runBlocking

class ClipboardWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent) = Factory(applicationContext)
}

class Factory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private var items = mutableListOf<ClipboardItem>()
    private val db = AppDatabase.getDatabase(context)

    override fun onCreate() { loadData() }
    override fun onDataSetChanged() { loadData() }

    private fun loadData() {
        runBlocking { items = db.clipboardDao().getAllItems().take(10).toMutableList() }
    }

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_clipboard_item)
        if (position < items.size) {
            val item = items[position]
            views.setTextViewText(R.id.clipboard_text, item.getPreviewText(50))
            views.setTextViewText(R.id.usage_count, "${item.usageCount}回")
            val fillIn = Intent().apply { putExtra(ClipboardWidgetProvider.EXTRA_CONTENT, item.content) }
            views.setOnClickFillInIntent(R.id.widget_item_container, fillIn)
        }
        return views
    }

    override fun getCount() = items.size
    override fun getLoadingView() = null
    override fun getViewTypeCount() = 1
    override fun getItemId(position: Int) = if (position < items.size) items[position].id else position.toLong()
    override fun hasStableIds() = true
    override fun onDestroy() { items.clear() }
}
