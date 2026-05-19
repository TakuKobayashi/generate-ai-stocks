package com.example.packinglist.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.packinglist.databinding.ItemPackingListBinding
import com.example.packinglist.model.PackingList

class PackingListAdapter(
    private val onItemClick: (PackingList) -> Unit,
    private val onEditClick: (PackingList) -> Unit,
    private val onDeleteClick: (PackingList) -> Unit
) : ListAdapter<PackingList, PackingListAdapter.ViewHolder>(PackingListDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemPackingListBinding.inflate(
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
        private val binding: ItemPackingListBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(packingList: PackingList) {
            binding.packingListName.text = packingList.name
            binding.packingListDescription.text = packingList.description
            
            binding.root.setOnClickListener {
                onItemClick(packingList)
            }
            
            binding.btnEdit.setOnClickListener {
                onEditClick(packingList)
            }
            
            binding.btnDelete.setOnClickListener {
                onDeleteClick(packingList)
            }
        }
    }

    private class PackingListDiffCallback : DiffUtil.ItemCallback<PackingList>() {
        override fun areItemsTheSame(oldItem: PackingList, newItem: PackingList): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: PackingList, newItem: PackingList): Boolean {
            return oldItem == newItem
        }
    }
}
