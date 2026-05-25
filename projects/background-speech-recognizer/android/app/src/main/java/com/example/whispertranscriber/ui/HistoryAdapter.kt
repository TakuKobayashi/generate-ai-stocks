package com.example.whispertranscriber.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.whispertranscriber.R
import com.example.whispertranscriber.service.TranscriptionService
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HistoryAdapter(
    private val onItemLongClick: (TranscriptionService.TranscriptionResult) -> Unit = {},
) : ListAdapter<TranscriptionService.TranscriptionResult, HistoryAdapter.ViewHolder>(DIFF_CALLBACK) {

    companion object {
        private val DIFF_CALLBACK =
            object : DiffUtil.ItemCallback<TranscriptionService.TranscriptionResult>() {
                override fun areItemsTheSame(a: TranscriptionService.TranscriptionResult, b: TranscriptionService.TranscriptionResult) =
                    a.timestamp == b.timestamp
                override fun areContentsTheSame(a: TranscriptionService.TranscriptionResult, b: TranscriptionService.TranscriptionResult) =
                    a == b
            }

        private val TIME_FORMAT = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        private val DATE_FORMAT = SimpleDateFormat("M/d HH:mm:ss", Locale.getDefault())
    }

    inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val timeText: TextView = itemView.findViewById(R.id.text_time)
        val durationText: TextView = itemView.findViewById(R.id.text_duration)
        val transcriptionText: TextView = itemView.findViewById(R.id.text_transcription)

        init {
            itemView.setOnLongClickListener {
                val item = getItem(bindingAdapterPosition)
                onItemLongClick(item)
                true
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_transcription, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        val date = Date(item.timestamp)

        // 今日の録音は時刻のみ、それ以外は日付も表示
        val isToday = android.text.format.DateUtils.isToday(item.timestamp)
        holder.timeText.text = if (isToday) TIME_FORMAT.format(date) else DATE_FORMAT.format(date)
        holder.durationText.text = "%.1fs".format(item.durationSeconds)
        holder.transcriptionText.text = item.text
    }
}
