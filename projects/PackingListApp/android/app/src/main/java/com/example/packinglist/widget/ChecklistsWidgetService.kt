package com.example.packinglist.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.packinglist.R
import com.example.packinglist.data.AppDatabase
import com.example.packinglist.model.Checklist
import com.example.packinglist.model.Event
import kotlinx.coroutines.runBlocking
import java.text.SimpleDateFormat
import java.util.*

class ChecklistsWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return ChecklistsRemoteViewsFactory(this.applicationContext, intent)
    }
}

class ChecklistsRemoteViewsFactory(
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
    
    private var checklists: List<Checklist> = emptyList()
    private val checklistInfoMap = mutableMapOf<Long, ChecklistInfo>()

    data class ChecklistInfo(
        val checklist: Checklist,
        val eventTitle: String,
        val eventDate: String,
        val checkedCount: Int,
        val totalCount: Int
    )

    override fun onCreate() {
        AppDatabase.getDatabase(context)
    }

    override fun onDataSetChanged() {
        runBlocking {
            val checklistDao = AppDatabase.getInstance().checklistDao()
            val eventDao = AppDatabase.getInstance().eventDao()
            val checklistItemDao = AppDatabase.getInstance().checklistItemDao()
            
            checklists = checklistDao.findByPackingListIdSync(packingListId)
            checklistInfoMap.clear()
            
            for (checklist in checklists) {
                val event = eventDao.findById(checklist.eventId)
                val items = checklistItemDao.findByChecklistIdWithDetailsSync(checklist.id)
                
                val dateFormat = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.JAPANESE)
                val eventTitle = event?.title ?: "予定"
                val eventDate = event?.let { dateFormat.format(Date(it.startTime)) } ?: ""
                val checkedCount = items.count { it.isChecked }
                val totalCount = items.size
                
                checklistInfoMap[checklist.id] = ChecklistInfo(
                    checklist, eventTitle, eventDate, checkedCount, totalCount
                )
            }
        }
    }

    override fun onDestroy() {
        checklists = emptyList()
        checklistInfoMap.clear()
    }

    override fun getCount(): Int = checklists.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_checklist_item)
        
        if (position >= checklists.size) {
            return views
        }
        
        val checklist = checklists[position]
        val info = checklistInfoMap[checklist.id]
        
        if (info != null) {
            views.setTextViewText(R.id.textEventTitle, info.eventTitle)
            views.setTextViewText(R.id.textEventDate, info.eventDate)
            views.setTextViewText(R.id.textProgress, "${info.checkedCount} / ${info.totalCount}")
            
            // チェックリスト詳細を見るボタンのクリックイベント
            val viewDetailIntent = Intent().apply {
                action = PackingListWidgetProvider.ACTION_VIEW_CHECKLIST_DETAIL
                putExtra(PackingListWidgetProvider.EXTRA_CHECKLIST_ID, checklist.id)
            }
            views.setOnClickFillInIntent(R.id.btnViewChecklist, viewDetailIntent)
        }
        
        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
