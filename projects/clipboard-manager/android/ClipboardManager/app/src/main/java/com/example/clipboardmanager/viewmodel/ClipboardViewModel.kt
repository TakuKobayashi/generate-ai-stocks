package com.example.clipboardmanager.viewmodel

import androidx.lifecycle.*
import com.example.clipboardmanager.data.ClipboardItem
import com.example.clipboardmanager.repository.ClipboardRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ClipboardUiState(
    val items: List<ClipboardItem> = emptyList(),
    val searchQuery: String = "",
    val sortBy: String = "last_used_at",
    val ascending: Boolean = false,
    val selectedItems: Set<Long> = emptySet(),
    val isSelectionMode: Boolean = false,
    val isLoading: Boolean = false
)

class ClipboardViewModel(private val repository: ClipboardRepository) : ViewModel() {
    private val _searchQuery = MutableStateFlow("")
    private val _sortBy = MutableStateFlow("last_used_at")
    private val _ascending = MutableStateFlow(false)
    private val _selectedItems = MutableStateFlow<Set<Long>>(emptySet())
    private val _isSelectionMode = MutableStateFlow(false)

    @OptIn(ExperimentalCoroutinesApi::class)
    private val _items: StateFlow<List<ClipboardItem>> = _searchQuery
        .flatMapLatest { query ->
            if (query.length >= 2) repository.searchItems(query)
            else repository.getAllItems()
        }
        .combine(_sortBy.combine(_ascending) { s, a -> Pair(s, a) }) { items, (sortBy, asc) ->
            when (sortBy) {
                "created_at" -> if (asc) items.sortedBy { it.createdAt } else items.sortedByDescending { it.createdAt }
                "usage_count" -> if (asc) items.sortedBy { it.usageCount } else items.sortedByDescending { it.usageCount }
                else -> if (asc) items.sortedBy { it.lastUsedAt } else items.sortedByDescending { it.lastUsedAt }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val uiState: StateFlow<ClipboardUiState> = combine(
        _items, _searchQuery, _sortBy, _ascending, _selectedItems, _isSelectionMode
    ) { arr ->
        @Suppress("UNCHECKED_CAST")
        ClipboardUiState(
            items = arr[0] as List<ClipboardItem>,
            searchQuery = arr[1] as String,
            sortBy = arr[2] as String,
            ascending = arr[3] as Boolean,
            selectedItems = arr[4] as Set<Long>,
            isSelectionMode = arr[5] as Boolean
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ClipboardUiState())

    fun updateSearchQuery(query: String) { _searchQuery.value = query }

    fun updateSort(sortBy: String) {
        if (_sortBy.value == sortBy) _ascending.value = !_ascending.value
        else { _sortBy.value = sortBy; _ascending.value = false }
    }

    fun copyToClipboard(item: ClipboardItem) { viewModelScope.launch { repository.copyToClipboard(item) } }

    fun toggleSelectionMode() {
        _isSelectionMode.value = !_isSelectionMode.value
        if (!_isSelectionMode.value) _selectedItems.value = emptySet()
    }

    fun toggleItemSelection(id: Long) {
        _selectedItems.value = _selectedItems.value.let {
            if (it.contains(id)) it - id else it + id
        }
    }

    fun deleteSelectedItems() {
        viewModelScope.launch {
            repository.deleteItems(_selectedItems.value.toList())
            _selectedItems.value = emptySet()
            _isSelectionMode.value = false
        }
    }
}

class ClipboardViewModelFactory(private val repository: ClipboardRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        ClipboardViewModel(repository) as T
}
