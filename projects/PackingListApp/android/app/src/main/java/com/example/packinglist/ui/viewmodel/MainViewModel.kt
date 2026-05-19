package com.example.packinglist.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.asLiveData
import androidx.lifecycle.viewModelScope
import com.example.packinglist.model.PackingList
import kotlinx.coroutines.launch

class MainViewModel : ViewModel() {

    val packingLists = PackingList.findAll().asLiveData()

    fun insertPackingList(name: String, description: String) {
        viewModelScope.launch {
            PackingList.create(name, description)
        }
    }

    fun updatePackingList(packingList: PackingList) {
        viewModelScope.launch {
            packingList.save()
        }
    }

    fun deletePackingList(packingList: PackingList) {
        viewModelScope.launch {
            packingList.delete()
        }
    }
}
