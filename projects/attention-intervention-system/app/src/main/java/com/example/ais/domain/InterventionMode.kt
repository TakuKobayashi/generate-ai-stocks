package com.example.ais.domain

enum class InterventionMode(val label: String, val description: String) {
    SOFT(
        label = "Soft",
        description = "通知のみ"
    ),
    NORMAL(
        label = "Normal",
        description = "通知 + 起動時表示"
    ),
    HARD(
        label = "Hard",
        description = "通知 + 起動時 + 画面ON割り込み"
    )
}
