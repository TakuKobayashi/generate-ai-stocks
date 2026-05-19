package com.example.packinglist.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.packinglist.R
import com.example.packinglist.data.AppDatabase
import com.example.packinglist.model.PackingList
import kotlinx.coroutines.runBlocking

class PackingListWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return PackingListRemoteViewsFactory(this.applicationContext, intent)
    }
}

class PackingListRemoteViewsFactory(
    private val context: Context,
    intent: Intent
) : RemoteViewsService.RemoteViewsFactory {

    private val appWidgetId: Int = intent.getIntExtra(
        AppWidgetManager.EXTRA_APPWIDGET_ID,
        AppWidgetManager.INVALID_APPWIDGET_ID
    )
    
    private var packingLists: List<PackingList> = emptyList()

    override fun onCreate() {
        // データベースを初期化
        AppDatabase.getDatabase(context)
    }

    override fun onDataSetChanged() {
        // データを取得
        runBlocking {
            val dao = AppDatabase.getInstance().packingListDao()
            // Flowから値を取得するため、直接DAOを使用
            packingLists = dao.findAllSync()
        }
    }

    override fun onDestroy() {
        packingLists = emptyList()
    }

    override fun getCount(): Int = packingLists.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_packing_list_item)
        
        if (position >= packingLists.size) {
            return views
        }
        
        val packingList = packingLists[position]
        views.setTextViewText(R.id.textPackingListName, packingList.name)
        views.setTextViewText(R.id.textPackingListDescription, packingList.description)
        
        // 持ち物を見るボタンのクリックイベント
        val viewItemsIntent = Intent().apply {
            action = PackingListWidgetProvider.ACTION_VIEW_ITEMS
            putExtra(PackingListWidgetProvider.EXTRA_PACKING_LIST_ID, packingList.id)
            putExtra(PackingListWidgetProvider.EXTRA_PACKING_LIST_NAME, packingList.name)
        }
        views.setOnClickFillInIntent(R.id.btnViewItems, viewItemsIntent)
        
        // チェックリストを見るボタンのクリックイベント
        val viewChecklistsIntent = Intent().apply {
            action = PackingListWidgetProvider.ACTION_VIEW_CHECKLISTS
            putExtra(PackingListWidgetProvider.EXTRA_PACKING_LIST_ID, packingList.id)
            putExtra(PackingListWidgetProvider.EXTRA_PACKING_LIST_NAME, packingList.name)
        }
        views.setOnClickFillInIntent(R.id.btnViewChecklists, viewChecklistsIntent)
        
        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
