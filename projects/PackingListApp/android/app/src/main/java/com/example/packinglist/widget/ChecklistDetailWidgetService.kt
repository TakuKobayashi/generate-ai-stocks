package com.example.packinglist.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.packinglist.R
import com.example.packinglist.data.AppDatabase
import com.example.packinglist.model.ChecklistItem
import com.example.packinglist.model.ChecklistItemWithDetails
import kotlinx.coroutines.runBlocking

class ChecklistDetailWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return ChecklistDetailRemoteViewsFactory(this.applicationContext, intent)
    }
}

class ChecklistDetailRemoteViewsFactory(
    private val context: Context,
    intent: Intent
) : RemoteViewsService.RemoteViewsFactory {

    private val appWidgetId: Int = intent.getIntExtra(
        AppWidgetManager.EXTRA_APPWIDGET_ID,
        AppWidgetManager.INVALID_APPWIDGET_ID
    )
    
    private val checklistId: Long = intent.getLongExtra(
        PackingListWidgetProvider.EXTRA_CHECKLIST_ID,
        -1
    )
    
    private var items: List<ChecklistItemWithDetails> = emptyList()

    override fun onCreate() {
        AppDatabase.getDatabase(context)
    }

    override fun onDataSetChanged() {
        runBlocking {
            val dao = AppDatabase.getInstance().checklistItemDao()
            items = dao.findByChecklistIdWithDetailsSync(checklistId)
        }
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_checklist_detail_item)
        
        if (position >= items.size) {
            return views
        }
        
        val item = items[position]
        views.setTextViewText(R.id.textItemName, item.name)
        views.setTextViewText(R.id.textItemQuantity, "数量: ${item.quantity}")
        views.setBoolean(R.id.checkboxItem, "setChecked", item.isChecked)
        
        // チェックボックスのクリックイベント
        val toggleIntent = Intent().apply {
            action = PackingListWidgetProvider.ACTION_TOGGLE_CHECK
            putExtra(PackingListWidgetProvider.EXTRA_CHECKLIST_ITEM_ID, item.checklistItemId)
        }
        views.setOnClickFillInIntent(R.id.checkboxItem, toggleIntent)
        
        // アイテム全体のクリックでもチェック状態を切り替え
        views.setOnClickFillInIntent(R.id.checkboxItem, toggleIntent)
        
        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
