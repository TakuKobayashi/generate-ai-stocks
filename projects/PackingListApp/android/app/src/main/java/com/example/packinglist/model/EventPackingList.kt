package com.example.packinglist.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "event_packing_lists",
    primaryKeys = ["eventId", "packingListId"],
    foreignKeys = [
        ForeignKey(
            entity = Event::class,
            parentColumns = ["id"],
            childColumns = ["eventId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = PackingList::class,
            parentColumns = ["id"],
            childColumns = ["packingListId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("eventId"), Index("packingListId")]
)
data class EventPackingList(
    val eventId: String,
    val packingListId: Long
)
