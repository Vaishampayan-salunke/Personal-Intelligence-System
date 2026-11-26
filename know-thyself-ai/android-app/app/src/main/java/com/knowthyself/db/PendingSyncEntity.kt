package com.knowthyself.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_sync_queue")
data class PendingSyncEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val deviceId: String,
    val recordedAt: String,
    val syncId: String,
    val steps: Int?,
    val screenTimeMinutes: Double?,
    val sleepMinutes: Double?,
    val exerciseMinutes: Int?,
    val waterMl: Double?,
    val createdAt: Long = System.currentTimeMillis()
)
