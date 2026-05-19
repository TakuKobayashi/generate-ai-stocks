package com.example.packinglist.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.packinglist.databinding.ActivityMainBinding

class EventListActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.apply {
            title = "予定一覧"
            setDisplayHomeAsUpEnabled(true)
        }
        
        // TODO: Implement event list functionality with ActiveRecord pattern
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}
