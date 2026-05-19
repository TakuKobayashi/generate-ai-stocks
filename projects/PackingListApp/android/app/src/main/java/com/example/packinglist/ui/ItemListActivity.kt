package com.example.packinglist.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.packinglist.R
import com.example.packinglist.databinding.ActivityItemListBinding
import com.example.packinglist.databinding.DialogAddItemBinding
import com.example.packinglist.ui.adapter.ItemAdapter
import com.example.packinglist.ui.adapter.ItemTouchHelperCallback
import com.example.packinglist.ui.adapter.ChecklistSummaryAdapter
import com.example.packinglist.ui.viewmodel.ItemListViewModel
import com.example.packinglist.ui.viewmodel.ItemListViewModelFactory
import com.example.packinglist.model.Item
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdView

class ItemListActivity : AppCompatActivity() {
    private lateinit var binding: ActivityItemListBinding
    private lateinit var itemAdapter: ItemAdapter
    private lateinit var checklistAdapter: ChecklistSummaryAdapter
    private lateinit var itemTouchHelper: ItemTouchHelper
    private lateinit var adView: AdView
    
    private val packingListId: Long by lazy {
        intent.getLongExtra("PACKING_LIST_ID", -1)
    }
    
    private val packingListName: String by lazy {
        intent.getStringExtra("PACKING_LIST_NAME") ?: ""
    }
    
    private val viewModel: ItemListViewModel by viewModels {
        ItemListViewModelFactory(packingListId)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityItemListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.apply {
            title = packingListName
            setDisplayHomeAsUpEnabled(true)
        }

        setupAds()
        setupRecyclerView()
        setupObservers()
        setupClickListeners()
    }
    
    private fun setupAds() {
        adView = binding.adView
        val adRequest = AdRequest.Builder().build()
        adView.loadAd(adRequest)
    }

    override fun onPause() {
        adView.pause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        adView.resume()
    }

    override fun onDestroy() {
        adView.destroy()
        super.onDestroy()
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    private fun setupRecyclerView() {
        itemAdapter = ItemAdapter(
            onEditClick = { item ->
                showEditItemDialog(item)
            },
            onDeleteClick = { item ->
                showDeleteItemDialog(item)
            },
            onStartDrag = { viewHolder ->
                itemTouchHelper.startDrag(viewHolder)
            }
        )
        
        binding.itemsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.itemsRecyclerView.adapter = itemAdapter
        
        val callback = ItemTouchHelperCallback(itemAdapter) { fromPosition, toPosition ->
            val items = viewModel.items.value ?: return@ItemTouchHelperCallback
            viewModel.updateItemPositions(items)
        }
        itemTouchHelper = ItemTouchHelper(callback)
        itemTouchHelper.attachToRecyclerView(binding.itemsRecyclerView)
        
        // チェックリスト用のRecyclerView
        checklistAdapter = ChecklistSummaryAdapter { checklist ->
            val intent = Intent(this, ChecklistActivity::class.java).apply {
                putExtra("CHECKLIST_ID", checklist.checklistId)
                putExtra("EVENT_TITLE", checklist.eventTitle)
                putExtra("EVENT_START_TIME", checklist.eventStartTime)
                putExtra("PACKING_LIST_NAME", packingListName)
            }
            startActivity(intent)
        }
        binding.checklistsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.checklistsRecyclerView.adapter = checklistAdapter
    }

    private fun setupObservers() {
        viewModel.items.observe(this) { items ->
            itemAdapter.submitList(items)
            binding.emptyTextView.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        }
        
        viewModel.checklists.observe(this) { checklists ->
            binding.emptyChecklistsTextView.visibility = 
                if (checklists.isEmpty()) View.VISIBLE else View.GONE
            
            // TODO: チェックリストの詳細情報を取得して表示
        }
    }

    private fun setupClickListeners() {
        binding.fabAddItem.setOnClickListener {
            showAddItemDialog()
        }
    }

    private fun showAddItemDialog() {
        val dialogBinding = DialogAddItemBinding.inflate(layoutInflater)
        
        AlertDialog.Builder(this)
            .setTitle(R.string.add_item_title)
            .setView(dialogBinding.root)
            .setPositiveButton(R.string.save) { _, _ ->
                val name = dialogBinding.editItemName.text.toString()
                val quantity = dialogBinding.editItemQuantity.text.toString().toIntOrNull() ?: 1
                
                if (name.isNotBlank()) {
                    viewModel.insertItem(name, quantity)
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showEditItemDialog(item: Item) {
        val dialogBinding = DialogAddItemBinding.inflate(layoutInflater)
        dialogBinding.editItemName.setText(item.name)
        dialogBinding.editItemQuantity.setText(item.quantity.toString())
        
        AlertDialog.Builder(this)
            .setTitle(R.string.edit_item_title)
            .setView(dialogBinding.root)
            .setPositiveButton(R.string.save) { _, _ ->
                val name = dialogBinding.editItemName.text.toString()
                val quantity = dialogBinding.editItemQuantity.text.toString().toIntOrNull() ?: 1
                
                if (name.isNotBlank()) {
                    item.name = name
                    item.quantity = quantity
                    viewModel.updateItem(item)
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showDeleteItemDialog(item: Item) {
        AlertDialog.Builder(this)
            .setTitle(R.string.delete_item_title)
            .setMessage(R.string.delete_item_message)
            .setPositiveButton(R.string.delete) { _, _ ->
                viewModel.deleteItem(item)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }
}
