package com.example.packinglist.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.packinglist.R
import com.example.packinglist.databinding.ActivityMainBinding
import com.example.packinglist.databinding.DialogAddPackingListBinding
import com.example.packinglist.ui.adapter.PackingListAdapter
import com.example.packinglist.ui.viewmodel.MainViewModel
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdView

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: PackingListAdapter
    private lateinit var adView: AdView
    
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
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

    private fun setupRecyclerView() {
        adapter = PackingListAdapter(
            onItemClick = { packingList ->
                val intent = Intent(this, ItemListActivity::class.java).apply {
                    putExtra("PACKING_LIST_ID", packingList.id)
                    putExtra("PACKING_LIST_NAME", packingList.name)
                }
                startActivity(intent)
            },
            onEditClick = { packingList ->
                showEditPackingListDialog(packingList)
            },
            onDeleteClick = { packingList ->
                showDeletePackingListDialog(packingList)
            }
        )
        
        binding.packingListsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.packingListsRecyclerView.adapter = adapter
    }

    private fun setupObservers() {
        viewModel.packingLists.observe(this) { lists ->
            adapter.submitList(lists)
            binding.emptyTextView.visibility = if (lists.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    private fun setupClickListeners() {
        binding.fabAddPackingList.setOnClickListener {
            showAddPackingListDialog()
        }
        
        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_sync_calendar -> {
                    // TODO: Implement calendar sync
                    true
                }
                R.id.action_view_events -> {
                    startActivity(Intent(this, EventListActivity::class.java))
                    true
                }
                else -> false
            }
        }
    }

    private fun showAddPackingListDialog() {
        val dialogBinding = DialogAddPackingListBinding.inflate(layoutInflater)
        
        AlertDialog.Builder(this)
            .setTitle(R.string.add_packing_list_title)
            .setView(dialogBinding.root)
            .setPositiveButton(R.string.save) { _, _ ->
                val name = dialogBinding.editPackingListName.text.toString()
                val description = dialogBinding.editPackingListDescription.text.toString()
                
                if (name.isNotBlank()) {
                    viewModel.insertPackingList(name, description)
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showEditPackingListDialog(packingList: com.example.packinglist.model.PackingList) {
        val dialogBinding = DialogAddPackingListBinding.inflate(layoutInflater)
        dialogBinding.editPackingListName.setText(packingList.name)
        dialogBinding.editPackingListDescription.setText(packingList.description)
        
        AlertDialog.Builder(this)
            .setTitle(R.string.edit_packing_list_title)
            .setView(dialogBinding.root)
            .setPositiveButton(R.string.save) { _, _ ->
                val name = dialogBinding.editPackingListName.text.toString()
                val description = dialogBinding.editPackingListDescription.text.toString()
                
                if (name.isNotBlank()) {
                    packingList.name = name
                    packingList.description = description
                    viewModel.updatePackingList(packingList)
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showDeletePackingListDialog(packingList: com.example.packinglist.model.PackingList) {
        AlertDialog.Builder(this)
            .setTitle(R.string.delete_packing_list_title)
            .setMessage(R.string.delete_packing_list_message)
            .setPositiveButton(R.string.delete) { _, _ ->
                viewModel.deletePackingList(packingList)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }
}
