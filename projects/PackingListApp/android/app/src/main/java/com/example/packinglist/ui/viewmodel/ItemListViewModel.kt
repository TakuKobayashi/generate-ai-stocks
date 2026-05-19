package com.example.packinglist.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.asLiveData
import androidx.lifecycle.viewModelScope
import com.example.packinglist.model.Checklist
import com.example.packinglist.model.ChecklistItem
import com.example.packinglist.model.Item
import com.example.packinglist.model.PackingList
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class ItemListViewModel(
    private val packingListId: Long
) : ViewModel() {

    private var packingList: PackingList? = null
    
    val items = Item.findByPackingListId(packingListId).asLiveData()
    val checklists = Checklist.findByPackingListId(packingListId).asLiveData()

    init {
        viewModelScope.launch {
            packingList = PackingList.findById(packingListId)
        }
    }

    fun insertItem(name: String, quantity: Int) {
        viewModelScope.launch {
            Item.create(packingListId, name, quantity)
        }
    }

    fun updateItem(item: Item) {
        viewModelScope.launch {
            item.save()
        }
    }

    fun deleteItem(item: Item) {
        viewModelScope.launch {
            item.delete()
        }
    }

    fun updateItemPositions(items: List<Item>) {
        viewModelScope.launch {
            val updatedItems = items.mapIndexed { index, item ->
                item.copy(position = index)
            }
            Item.updateAll(updatedItems)
        }
    }

    suspend fun createChecklistForEvent(eventId: String): Long {
        // チェックリストを作成
        val checklist = Checklist.create(eventId, packingListId)
        
        // すべての持ち物をチェックリストアイテムとして追加
        val currentItems = items.value ?: emptyList()
        val checklistItems = currentItems.map { item ->
            ChecklistItem(
                checklistId = checklist.id,
                itemId = item.id,
                isChecked = false
            )
        }
        ChecklistItem.insertAll(checklistItems)
        
        return checklist.id
    }
}

class ItemListViewModelFactory(
    private val packingListId: Long
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ItemListViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return ItemListViewModel(packingListId) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
