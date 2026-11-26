package com.knowthyself.data

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.temporal.ChronoUnit

data class HealthConnectSummary(
    val sleepMinutes: Double,
    val exerciseMinutes: Int,
    val hydrationMl: Double,
    val isAvailable: Boolean
)

class HealthConnectTracker(private val context: Context) {

    val isSupported: Boolean
        get() = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    private val healthConnectClient by lazy {
        if (isSupported) HealthConnectClient.getOrCreate(context) else null
    }

    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
        HealthPermission.getWritePermission(HydrationRecord::class)
    )

    suspend fun hasAllPermissions(): Boolean {
        val client = healthConnectClient ?: return false
        val granted = client.permissionController.getGrantedPermissions()
        return granted.containsAll(permissions)
    }

    suspend fun getTodayHealthSummary(): HealthConnectSummary {
        val client = healthConnectClient
        if (client == null || !hasAllPermissions()) {
            return HealthConnectSummary(
                sleepMinutes = 0.0,
                exerciseMinutes = 0,
                hydrationMl = 0.0,
                isAvailable = false
            )
        }

        val now = Instant.now()
        // Query from 24 hours ago up to now to capture last night's completed sleep session
        val startTime = now.minus(24, ChronoUnit.HOURS)
        val timeFilter = TimeRangeFilter.between(startTime, now)

        var totalSleepMinutes = 0.0
        var totalExerciseMinutes = 0
        var totalHydrationMl = 0.0

        try {
            // 1. Read Sleep Sessions
            val sleepResponse = client.readRecords(
                ReadRecordsRequest(
                    recordType = SleepSessionRecord::class,
                    timeRangeFilter = timeFilter
                )
            )
            for (session in sleepResponse.records) {
                val durationMin = ChronoUnit.MINUTES.between(session.startTime, session.endTime)
                if (durationMin > 60) { // Valid sleep session > 1 hour
                    totalSleepMinutes = maxOf(totalSleepMinutes, durationMin.toDouble())
                }
            }

            // 2. Read Exercise Sessions
            val exerciseResponse = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = timeFilter
                )
            )
            for (exercise in exerciseResponse.records) {
                val dur = ChronoUnit.MINUTES.between(exercise.startTime, exercise.endTime).toInt()
                totalExerciseMinutes += dur
            }

            // 3. Read Hydration Records
            val hydrationResponse = client.readRecords(
                ReadRecordsRequest(
                    recordType = HydrationRecord::class,
                    timeRangeFilter = timeFilter
                )
            )
            for (hyd in hydrationResponse.records) {
                totalHydrationMl += (hyd.volume.inLiters * 1000.0)
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }

        return HealthConnectSummary(
            sleepMinutes = totalSleepMinutes,
            exerciseMinutes = totalExerciseMinutes,
            hydrationMl = totalHydrationMl,
            isAvailable = true
        )
    }
}
