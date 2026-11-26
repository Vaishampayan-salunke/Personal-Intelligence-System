package com.knowthyself.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.knowthyself.data.HealthConnectTracker
import com.knowthyself.data.PreferencesManager
import com.knowthyself.data.SensorTracker
import com.knowthyself.data.UsageTracker
import com.knowthyself.db.AppDatabase
import com.knowthyself.db.PendingSyncEntity
import com.knowthyself.model.MobileMetricsAvailability
import com.knowthyself.model.MobileMetricsData
import com.knowthyself.model.MobileSyncPayload
import com.knowthyself.network.RetrofitClient
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class DataSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val prefs = PreferencesManager(applicationContext)
        if (!prefs.isConnected || prefs.authToken.isNullOrBlank()) {
            return Result.success()
        }

        val db = AppDatabase.getInstance(applicationContext)
        val dao = db.pendingSyncDao()
        val apiService = RetrofitClient.getApiService(prefs)

        // 1. First, drain any pending offline items
        try {
            val pending = dao.getPendingBatch()
            if (pending.isNotEmpty()) {
                val successfulIds = mutableListOf<Long>()
                for (item in pending) {
                    val payload = MobileSyncPayload(
                        deviceId = item.deviceId,
                        recordedAt = item.recordedAt,
                        source = "android_offline_queue",
                        metrics = MobileMetricsData(
                            steps = item.steps,
                            screenTimeMinutes = item.screenTimeMinutes,
                            sleepMinutes = item.sleepMinutes,
                            exerciseMinutes = item.exerciseMinutes,
                            waterMl = item.waterMl
                        ),
                        available = MobileMetricsAvailability(),
                        syncId = item.syncId
                    )
                    val response = apiService.syncMetrics(payload)
                    if (response.isSuccessful) {
                        successfulIds.add(item.id)
                    }
                }
                if (successfulIds.isNotEmpty()) {
                    dao.deleteByIds(successfulIds)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. Collect current real-time metrics
        val sensorTracker = SensorTracker(applicationContext, prefs)
        val usageTracker = UsageTracker(applicationContext)
        val healthTracker = HealthConnectTracker(applicationContext)

        val steps = sensorTracker.getEstimatedSteps()
        val screenTimeMinutes = usageTracker.getTodayScreenTimeMinutes()
        val healthSummary = healthTracker.getTodayHealthSummary()

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val isoTimestamp = sdf.format(Date())
        val syncId = "sync_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 6)}"

        val currentPayload = MobileSyncPayload(
            deviceId = prefs.deviceId,
            recordedAt = isoTimestamp,
            source = "android",
            metrics = MobileMetricsData(
                steps = if (steps > 0) steps else null,
                screenTimeMinutes = if (screenTimeMinutes > 0) screenTimeMinutes else null,
                sleepMinutes = if (healthSummary.sleepMinutes > 0) healthSummary.sleepMinutes else null,
                exerciseMinutes = if (healthSummary.exerciseMinutes > 0) healthSummary.exerciseMinutes else null,
                waterMl = if (healthSummary.hydrationMl > 0) healthSummary.hydrationMl else null
            ),
            available = MobileMetricsAvailability(
                steps = true,
                screenTime = usageTracker.hasUsagePermission(),
                sleep = healthSummary.isAvailable,
                exercise = healthSummary.isAvailable,
                hydration = healthSummary.isAvailable
            ),
            syncId = syncId
        )

        return try {
            val response = apiService.syncMetrics(currentPayload)
            if (response.isSuccessful) {
                prefs.lastSyncTimestamp = System.currentTimeMillis()
                Result.success()
            } else {
                // Queue locally for retry
                dao.insert(
                    PendingSyncEntity(
                        deviceId = prefs.deviceId,
                        recordedAt = isoTimestamp,
                        syncId = syncId,
                        steps = currentPayload.metrics.steps,
                        screenTimeMinutes = currentPayload.metrics.screenTimeMinutes,
                        sleepMinutes = currentPayload.metrics.sleepMinutes,
                        exerciseMinutes = currentPayload.metrics.exerciseMinutes,
                        waterMl = currentPayload.metrics.waterMl
                    )
                )
                Result.retry()
            }
        } catch (e: Exception) {
            // Queue locally for retry
            dao.insert(
                PendingSyncEntity(
                    deviceId = prefs.deviceId,
                    recordedAt = isoTimestamp,
                    syncId = syncId,
                    steps = currentPayload.metrics.steps,
                    screenTimeMinutes = currentPayload.metrics.screenTimeMinutes,
                    sleepMinutes = currentPayload.metrics.sleepMinutes,
                    exerciseMinutes = currentPayload.metrics.exerciseMinutes,
                    waterMl = currentPayload.metrics.waterMl
                )
            )
            Result.retry()
        }
    }
}
