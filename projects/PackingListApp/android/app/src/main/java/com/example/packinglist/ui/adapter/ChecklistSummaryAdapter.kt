package com.example.packinglist.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.packinglist.R
import com.example.packinglist.databinding.ItemChecklistBinding
import java.text.SimpleDateFormat
import java.util.*

data class ChecklistSummary(
    val checklistId: Long,
    val eventId: String,
    val eventTitle: String,
    val eventStartTime: Long,
    val checkedCount: Int,
    val totalCount: Int
)

class ChecklistSummaryAdapter(
    private val onItemClick: (ChecklistSummary) -> Unit
) : ListAdapter<ChecklistSummary, ChecklistSummaryAdapter.ViewHolder>(ChecklistSummaryDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemChecklistBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(
        private val binding: ItemChecklistBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(checklist: ChecklistSummary) {
            binding.eventTitle.text = checklist.eventTitle
            
            val dateFormat = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.JAPANESE)
            binding.eventDate.text = dateFormat.format(Date(checklist.eventStartTime))
            
            binding.progressText.text = binding.root.context.getString(
                R.string.checked_format,
                checklist.checkedCount,
                checklist.totalCount
            )
            
            binding.btnViewChecklist.setOnClickListener {
                onItemClick(checklist)
            }
        }
    }

    private class ChecklistSummaryDiffCallback : DiffUtil.ItemCallback<ChecklistSummary>() {
        override fun areItemsTheSame(oldItem: ChecklistSummary, newItem: ChecklistSummary): Boolean {
            return oldItem.checklistId == newItem.checklistId
        }

        override fun areContentsTheSame(oldItem: ChecklistSummary, newItem: ChecklistSummary): Boolean {
            return oldItem == newItem
        }
    }
}
