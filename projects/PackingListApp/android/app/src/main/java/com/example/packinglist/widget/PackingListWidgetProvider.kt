package com.example.packinglist.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.example.packinglist.R
import kotlinx.coroutines.launch

class PackingListWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_VIEW_ITEMS = "com.example.packinglist.ACTION_VIEW_ITEMS"
        const val ACTION_VIEW_CHECKLISTS = "com.example.packinglist.ACTION_VIEW_CHECKLISTS"
        const val ACTION_BACK = "com.example.packinglist.ACTION_BACK"
        const val ACTION_VIEW_CHECKLIST_DETAIL = "com.example.packinglist.ACTION_VIEW_CHECKLIST_DETAIL"
        const val ACTION_TOGGLE_CHECK = "com.example.packinglist.ACTION_TOGGLE_CHECK"
        const val ACTION_REFRESH = "com.example.packinglist.ACTION_REFRESH"
        
        const val EXTRA_PACKING_LIST_ID = "packing_list_id"
        const val EXTRA_PACKING_LIST_NAME = "packing_list_name"
        const val EXTRA_CHECKLIST_ID = "checklist_id"
        const val EXTRA_CHECKLIST_ITEM_ID = "checklist_item_id"
        
        const val PREF_NAME = "PackingListWidget"
        const val PREF_CURRENT_SCREEN = "current_screen"
        const val PREF_CURRENT_PACKING_LIST_ID = "current_packing_list_id"
        const val PREF_CURRENT_PACKING_LIST_NAME = "current_packing_list_name"
        const val PREF_CURRENT_CHECKLIST_ID = "current_checklist_id"
        
        const val SCREEN_PACKING_LISTS = 0
        const val SCREEN_ITEMS = 1
        const val SCREEN_CHECKLISTS = 2
        const val SCREEN_CHECKLIST_DETAIL = 3
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(
            android.content.ComponentName(context, PackingListWidgetProvider::class.java)
        )
        
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        
        when (intent.action) {
            ACTION_VIEW_ITEMS -> {
                val packingListId = intent.getLongExtra(EXTRA_PACKING_LIST_ID, -1)
                val packingListName = intent.getStringExtra(EXTRA_PACKING_LIST_NAME) ?: ""
                
                prefs.edit()
                    .putInt(PREF_CURRENT_SCREEN, SCREEN_ITEMS)
                    .putLong(PREF_CURRENT_PACKING_LIST_ID, packingListId)
                    .putString(PREF_CURRENT_PACKING_LIST_NAME, packingListName)
                    .apply()
                
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            }
            
            ACTION_VIEW_CHECKLISTS -> {
                val packingListId = intent.getLongExtra(EXTRA_PACKING_LIST_ID, -1)
                val packingListName = intent.getStringExtra(EXTRA_PACKING_LIST_NAME) ?: ""
                
                prefs.edit()
                    .putInt(PREF_CURRENT_SCREEN, SCREEN_CHECKLISTS)
                    .putLong(PREF_CURRENT_PACKING_LIST_ID, packingListId)
                    .putString(PREF_CURRENT_PACKING_LIST_NAME, packingListName)
                    .apply()
                
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            }
            
            ACTION_VIEW_CHECKLIST_DETAIL -> {
                val checklistId = intent.getLongExtra(EXTRA_CHECKLIST_ID, -1)
                
                prefs.edit()
                    .putInt(PREF_CURRENT_SCREEN, SCREEN_CHECKLIST_DETAIL)
                    .putLong(PREF_CURRENT_CHECKLIST_ID, checklistId)
                    .apply()
                
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            }
            
            ACTION_BACK -> {
                val currentScreen = prefs.getInt(PREF_CURRENT_SCREEN, SCREEN_PACKING_LISTS)
                val newScreen = when (currentScreen) {
                    SCREEN_ITEMS, SCREEN_CHECKLISTS -> SCREEN_PACKING_LISTS
                    SCREEN_CHECKLIST_DETAIL -> SCREEN_CHECKLISTS
                    else -> SCREEN_PACKING_LISTS
                }
                
                prefs.edit()
                    .putInt(PREF_CURRENT_SCREEN, newScreen)
                    .apply()
                
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            }
            
            ACTION_TOGGLE_CHECK -> {
                val checklistItemId = intent.getLongExtra(EXTRA_CHECKLIST_ITEM_ID, -1)
                
                // チェック状態を切り替え
                kotlinx.coroutines.GlobalScope.launch {
                    try {
                        val checklistItem = com.example.packinglist.model.ChecklistItem.findById(checklistItemId)
                        checklistItem?.toggleCheck()
                        
                        // ウィジェットを更新
                        for (appWidgetId in appWidgetIds) {
                            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.listViewChecklistItems)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
            
            ACTION_REFRESH -> {
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            }
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val currentScreen = prefs.getInt(PREF_CURRENT_SCREEN, SCREEN_PACKING_LISTS)
        
        val views = when (currentScreen) {
            SCREEN_ITEMS -> createItemsView(context, appWidgetId, prefs)
            SCREEN_CHECKLISTS -> createChecklistsView(context, appWidgetId, prefs)
            SCREEN_CHECKLIST_DETAIL -> createChecklistDetailView(context, appWidgetId, prefs)
            else -> createPackingListsView(context, appWidgetId)
        }
        
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun createPackingListsView(context: Context, appWidgetId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_packing_list)
        
        // リストビューの設定
        val intent = Intent(context, PackingListWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        views.setRemoteAdapter(R.id.listViewPackingLists, intent)
        
        // PendingIntentテンプレートの設定（リストアイテムのクリックを処理）
        val clickIntent = Intent(context, PackingListWidgetProvider::class.java)
        val clickPendingIntent = PendingIntent.getBroadcast(
            context, 0, clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.listViewPackingLists, clickPendingIntent)
        
        // リフレッシュボタンの設定
        val refreshIntent = Intent(context, PackingListWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context, 0, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btnRefresh, refreshPendingIntent)
        
        return views
    }

    private fun createItemsView(context: Context, appWidgetId: Int, prefs: android.content.SharedPreferences): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_items)
        
        val packingListName = prefs.getString(PREF_CURRENT_PACKING_LIST_NAME, "持ち物一覧")
        views.setTextViewText(R.id.textTitle, packingListName)
        
        // リストビューの設定
        val intent = Intent(context, ItemsWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            putExtra(EXTRA_PACKING_LIST_ID, prefs.getLong(PREF_CURRENT_PACKING_LIST_ID, -1))
        }
        views.setRemoteAdapter(R.id.listViewItems, intent)
        
        // 戻るボタンの設定
        val backIntent = Intent(context, PackingListWidgetProvider::class.java).apply {
            action = ACTION_BACK
        }
        val backPendingIntent = PendingIntent.getBroadcast(
            context, 0, backIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btnBack, backPendingIntent)
        
        return views
    }

    private fun createChecklistsView(context: Context, appWidgetId: Int, prefs: android.content.SharedPreferences): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_checklists)
        
        val packingListName = prefs.getString(PREF_CURRENT_PACKING_LIST_NAME, "チェックリスト")
        views.setTextViewText(R.id.textTitle, "$packingListName のチェックリスト")
        
        // リストビューの設定
        val intent = Intent(context, ChecklistsWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            putExtra(EXTRA_PACKING_LIST_ID, prefs.getLong(PREF_CURRENT_PACKING_LIST_ID, -1))
        }
        views.setRemoteAdapter(R.id.listViewChecklists, intent)
        
        // PendingIntentテンプレートの設定
        val clickIntent = Intent(context, PackingListWidgetProvider::class.java)
        val clickPendingIntent = PendingIntent.getBroadcast(
            context, 0, clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.listViewChecklists, clickPendingIntent)
        
        // 戻るボタンの設定
        val backIntent = Intent(context, PackingListWidgetProvider::class.java).apply {
            action = ACTION_BACK
        }
        val backPendingIntent = PendingIntent.getBroadcast(
            context, 0, backIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btnBack, backPendingIntent)
        
        return views
    }

    private fun createChecklistDetailView(context: Context, appWidgetId: Int, prefs: android.content.SharedPreferences): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_checklist_detail)
        
        // リストビューの設定
        val intent = Intent(context, ChecklistDetailWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            putExtra(EXTRA_CHECKLIST_ID, prefs.getLong(PREF_CURRENT_CHECKLIST_ID, -1))
        }
        views.setRemoteAdapter(R.id.listViewChecklistItems, intent)
        
        // PendingIntentテンプレートの設定
        val clickIntent = Intent(context, PackingListWidgetProvider::class.java)
        val clickPendingIntent = PendingIntent.getBroadcast(
            context, 0, clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.listViewChecklistItems, clickPendingIntent)
        
        // 戻るボタンの設定
        val backIntent = Intent(context, PackingListWidgetProvider::class.java).apply {
            action = ACTION_BACK
        }
        val backPendingIntent = PendingIntent.getBroadcast(
            context, 0, backIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btnBack, backPendingIntent)
        
        return views
    }
}
