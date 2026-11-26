package com.knowthyself.model

import com.google.gson.annotations.SerializedName

data class MobileConnectRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("model") val model: String?,
    @SerializedName("os_version") val osVersion: String?,
    @SerializedName("app_version") val appVersion: String = "1.0.0",
    @SerializedName("pairing_code") val pairingCode: String?
)

data class MobileDeviceResponse(
    @SerializedName("id") val id: Int,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("model") val model: String?,
    @SerializedName("os_version") val osVersion: String?,
    @SerializedName("is_connected") val isConnected: Boolean,
    @SerializedName("access_token") val accessToken: String?,
    @SerializedName("token_type") val tokenType: String?
)

data class MobileMetricsData(
    @SerializedName("steps") val steps: Int?,
    @SerializedName("screen_time_minutes") val screenTimeMinutes: Double?,
    @SerializedName("sleep_minutes") val sleepMinutes: Double?,
    @SerializedName("exercise_minutes") val exerciseMinutes: Int?,
    @SerializedName("water_ml") val waterMl: Double?
)

data class MobileMetricsAvailability(
    @SerializedName("steps") val steps: Boolean = true,
    @SerializedName("screen_time") val screenTime: Boolean = true,
    @SerializedName("sleep") val sleep: Boolean = false,
    @SerializedName("exercise") val exercise: Boolean = false,
    @SerializedName("hydration") val hydration: Boolean = true
)

data class MobileSyncPayload(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("recorded_at") val recordedAt: String,
    @SerializedName("source") val source: String = "android",
    @SerializedName("metrics") val metrics: MobileMetricsData,
    @SerializedName("available") val available: MobileMetricsAvailability,
    @SerializedName("sync_id") val syncId: String? = null
)

data class MobileSyncResponse(
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String,
    @SerializedName("synced_at") val syncedAt: String?,
    @SerializedName("device_id") val deviceId: String?,
    @SerializedName("current_metrics") val currentMetrics: Map<String, Any>?,
    @SerializedName("intelligence_score") val intelligenceScore: Int?
)

data class MobileStatusResponse(
    @SerializedName("is_connected") val isConnected: Boolean,
    @SerializedName("active_device_count") val activeDeviceCount: Int,
    @SerializedName("last_sync_at") val lastSyncAt: String?,
    @SerializedName("today_synced_summary") val todaySyncedSummary: Map<String, Any>?
)

data class PairingClaimRequest(
    @SerializedName("pairing_id") val pairingId: String? = null,
    @SerializedName("pairing_token") val pairingToken: String? = null,
    @SerializedName("pairing_code") val pairingCode: String? = null,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String?,
    @SerializedName("model") val model: String?,
    @SerializedName("os_version") val osVersion: String?,
    @SerializedName("app_version") val appVersion: String = "1.0.0"
)

data class PairingClaimResponse(
    @SerializedName("pairing_id") val pairingId: String,
    @SerializedName("status") val status: String,
    @SerializedName("account_name") val accountName: String,
    @SerializedName("account_masked_email") val accountMaskedEmail: String,
    @SerializedName("requires_approval") val requiresApproval: Boolean,
    @SerializedName("expires_in_seconds") val expiresInSeconds: Int
)

data class PairingApproveRequest(
    @SerializedName("pairing_id") val pairingId: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String?,
    @SerializedName("model") val model: String?,
    @SerializedName("os_version") val osVersion: String?,
    @SerializedName("app_version") val appVersion: String = "1.0.0",
    @SerializedName("approved") val approved: Boolean = true
)

data class PairingApproveResponse(
    @SerializedName("status") val status: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String,
    @SerializedName("user_id") val userId: Int
)
