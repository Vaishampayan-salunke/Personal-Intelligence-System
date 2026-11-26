package com.knowthyself.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface PendingSyncDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: PendingSyncEntity): Long

    @Query("SELECT * FROM pending_sync_queue ORDER BY createdAt ASC LIMIT 20")
    suspend fun getPendingBatch(): List<PendingSyncEntity>

    @Query("DELETE FROM pending_sync_queue WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Query("SELECT COUNT(*) FROM pending_sync_queue")
    suspend fun getPendingCount(): Int
}
