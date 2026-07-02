package com.example.ais.data.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Entity(tableName = "goals")
data class Goal(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "text")
    val text: String,

    @ColumnInfo(name = "display_order")
    val displayOrder: Int,

    @ColumnInfo(name = "is_active")
    val isActive: Boolean = true,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "date_key")
    val dateKey: String = todayKey()
) {
    // ── ドメインロジック ──────────────────────────────────

    fun isBlank(): Boolean = text.isBlank()

    fun isTooLong(): Boolean = text.length > 40

    fun validate(): GoalValidationResult = when {
        isBlank() -> GoalValidationResult.BLANK
        isTooLong() -> GoalValidationResult.TOO_LONG
        else -> GoalValidationResult.OK
    }

    fun updatedWith(newText: String): Goal = copy(
        text = newText,
        updatedAt = System.currentTimeMillis()
    )

    fun deactivated(): Goal = copy(isActive = false)

    // ── Factory ──────────────────────────────────────────

    companion object {
        private val formatter: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

        fun todayKey(): String = LocalDate.now().format(formatter)

        fun new(text: String, order: Int): Goal = Goal(
            text = text.trim(),
            displayOrder = order
        )
    }
}

enum class GoalValidationResult {
    OK, BLANK, TOO_LONG;

    fun message(): String = when (this) {
        OK -> ""
        BLANK -> ""
        TOO_LONG -> "目標は40文字以内にしてください"
    }
}
