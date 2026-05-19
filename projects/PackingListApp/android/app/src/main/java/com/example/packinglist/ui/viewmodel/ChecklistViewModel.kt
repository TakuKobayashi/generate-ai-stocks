package com.example.packinglist.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.asLiveData
import androidx.lifecycle.viewModelScope
import com.example.packinglist.model.ChecklistItem
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class ChecklistViewModel(
    private val checklistId: Long
) : ViewModel() {

    val checklistItems = ChecklistItem.findByChecklistIdWithDetails(checklistId).asLiveData()

    fun updateChecklistItem(checklistItemId: Long, isChecked: Boolean) {
        viewModelScope.launch {
            val item = ChecklistItem.findById(checklistItemId)
            item?.setChecked(isChecked)
        }
    }
    
    fun toggleChecklistItem(checklistItemId: Long) {
        viewModelScope.launch {
            val item = ChecklistItem.findById(checklistItemId)
            item?.toggleCheck()
        }
    }
}

class ChecklistViewModelFactory(
    private val checklistId: Long
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ChecklistViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return ChecklistViewModel(checklistId) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
