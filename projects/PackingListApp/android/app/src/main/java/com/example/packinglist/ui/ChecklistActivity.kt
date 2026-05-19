package com.example.packinglist.ui

import android.os.Bundle
import android.view.View
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.packinglist.databinding.ActivityChecklistBinding
import com.example.packinglist.ui.adapter.ChecklistItemAdapter
import com.example.packinglist.ui.viewmodel.ChecklistViewModel
import com.example.packinglist.ui.viewmodel.ChecklistViewModelFactory
import java.text.SimpleDateFormat
import java.util.*
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdView

class ChecklistActivity : AppCompatActivity() {
    private lateinit var binding: ActivityChecklistBinding
    private lateinit var adapter: ChecklistItemAdapter
    private lateinit var adView: AdView
    
    private val checklistId: Long by lazy {
        intent.getLongExtra("CHECKLIST_ID", -1)
    }
    
    private val eventTitle: String by lazy {
        intent.getStringExtra("EVENT_TITLE") ?: ""
    }
    
    private val eventStartTime: Long by lazy {
        intent.getLongExtra("EVENT_START_TIME", 0)
    }
    
    private val packingListName: String by lazy {
        intent.getStringExtra("PACKING_LIST_NAME") ?: ""
    }
    
    private val viewModel: ChecklistViewModel by viewModels {
        ChecklistViewModelFactory(checklistId)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChecklistBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.apply {
            title = "チェックリスト"
            setDisplayHomeAsUpEnabled(true)
        }

        setupUI()
        setupAds()
        setupRecyclerView()
        setupObservers()
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

    private fun setupUI() {
        binding.eventTitle.text = eventTitle
        binding.packingListName.text = packingListName
        
        val dateFormat = SimpleDateFormat("yyyy年MM月dd日 HH:mm", Locale.JAPANESE)
        binding.eventDate.text = dateFormat.format(Date(eventStartTime))
    }

    private fun setupRecyclerView() {
        adapter = ChecklistItemAdapter { item, isChecked ->
            viewModel.updateChecklistItem(item.checklistItemId, isChecked)
        }
        
        binding.checklistItemsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.checklistItemsRecyclerView.adapter = adapter
    }

    private fun setupObservers() {
        viewModel.checklistItems.observe(this) { items ->
            adapter.submitList(items)
            binding.emptyTextView.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
            
            // 進捗を更新
            val checkedCount = items.count { it.isChecked }
            val totalCount = items.size
            
            binding.progressText.text = getString(
                com.example.packinglist.R.string.checked_format,
                checkedCount,
                totalCount
            )
            
            if (totalCount > 0) {
                binding.progressBar.max = totalCount
                binding.progressBar.progress = checkedCount
            }
        }
    }
}
