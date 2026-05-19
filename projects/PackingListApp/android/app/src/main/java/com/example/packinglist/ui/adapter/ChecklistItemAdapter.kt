package com.example.packinglist.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.packinglist.databinding.ItemChecklistItemBinding
import com.example.packinglist.model.ChecklistItemWithDetails

class ChecklistItemAdapter(
    private val onCheckChanged: (ChecklistItemWithDetails, Boolean) -> Unit
) : ListAdapter<ChecklistItemWithDetails, ChecklistItemAdapter.ViewHolder>(
    ChecklistItemDiffCallback()
) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemChecklistItemBinding.inflate(
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
        private val binding: ItemChecklistItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: ChecklistItemWithDetails) {
            binding.itemName.text = item.name
            binding.itemQuantity.text = "数量: ${item.quantity}"
            binding.checkbox.isChecked = item.isChecked
            
            binding.checkbox.setOnCheckedChangeListener { _, isChecked ->
                onCheckChanged(item, isChecked)
            }
        }
    }

    private class ChecklistItemDiffCallback : DiffUtil.ItemCallback<ChecklistItemWithDetails>() {
        override fun areItemsTheSame(
            oldItem: ChecklistItemWithDetails,
            newItem: ChecklistItemWithDetails
        ): Boolean {
            return oldItem.checklistItemId == newItem.checklistItemId
        }

        override fun areContentsTheSame(
            oldItem: ChecklistItemWithDetails,
            newItem: ChecklistItemWithDetails
        ): Boolean {
            return oldItem == newItem
        }
    }
}
