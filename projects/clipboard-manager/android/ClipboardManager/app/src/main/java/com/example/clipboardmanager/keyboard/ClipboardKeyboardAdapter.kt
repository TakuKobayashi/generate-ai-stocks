package com.example.clipboardmanager.keyboard

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.clipboardmanager.R
import com.example.clipboardmanager.data.ClipboardItem

class ClipboardKeyboardAdapter(private val onClick: (ClipboardItem) -> Unit)
    : ListAdapter<ClipboardItem, ClipboardKeyboardAdapter.VH>(Diff()) {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val text: TextView = view.findViewById(R.id.clipboard_text)
        val count: TextView = view.findViewById(R.id.usage_count)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.keyboard_clipboard_item, parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = getItem(position)
        holder.text.text = item.getPreviewText(30)
        holder.count.text = "${item.usageCount}x"
        holder.itemView.setOnClickListener { onClick(item) }
    }

    class Diff : DiffUtil.ItemCallback<ClipboardItem>() {
        override fun areItemsTheSame(a: ClipboardItem, b: ClipboardItem) = a.id == b.id
        override fun areContentsTheSame(a: ClipboardItem, b: ClipboardItem) = a == b
    }
}
