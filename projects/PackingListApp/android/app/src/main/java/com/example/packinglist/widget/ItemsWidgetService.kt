package com.example.packinglist.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.packinglist.R
import com.example.packinglist.data.AppDatabase
import com.example.packinglist.model.Item
import kotlinx.coroutines.runBlocking

class ItemsWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return ItemsRemoteViewsFactory(this.applicationContext, intent)
    }
}

class ItemsRemoteViewsFactory(
    private val context: Context,
    intent: Intent
) : RemoteViewsService.RemoteViewsFactory {

    private val appWidgetId: Int = intent.getIntExtra(
        AppWidgetManager.EXTRA_APPWIDGET_ID,
        AppWidgetManager.INVALID_APPWIDGET_ID
    )
    
    private val packingListId: Long = intent.getLongExtra(
        PackingListWidgetProvider.EXTRA_PACKING_LIST_ID,
        -1
    )
    
    private var items: List<Item> = emptyList()

    override fun onCreate() {
        AppDatabase.getDatabase(context)
    }

    override fun onDataSetChanged() {
        runBlocking {
            val dao = AppDatabase.getInstance().itemDao()
            items = dao.findByPackingListIdSync(packingListId)
        }
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_item)
        
        if (position >= items.size) {
            return views
        }
        
        val item = items[position]
        views.setTextViewText(R.id.textItemName, item.name)
        views.setTextViewText(R.id.textItemQuantity, "数量: ${item.quantity}")
        
        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
