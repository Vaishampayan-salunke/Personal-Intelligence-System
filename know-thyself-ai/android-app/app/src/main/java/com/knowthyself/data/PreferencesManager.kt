package com.knowthyself.data

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "know_thyself_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        context.getSharedPreferences("know_thyself_fallback_prefs", Context.MODE_PRIVATE)
    }

    var serverUrl: String
        get() = prefs.getString("server_url", "https://personal-intelligence-system-gamma.vercel.app") ?: ""
        set(value) = prefs.edit().putString("server_url", value.trim().trimEnd('/')).apply()

    var authToken: String?
        get() = prefs.getString("auth_token", null)
        set(value) = prefs.edit().putString("auth_token", value).apply()

    var deviceId: String
        get() {
            var id = prefs.getString("device_id", null)
            if (id == null) {
                id = "android_${Build.MANUFACTURER.lowercase(Locale.ROOT)}_${UUID.randomUUID().toString().substring(0, 8)}"
                prefs.edit().putString("device_id", id).apply()
            }
            return id
        }
        set(value) = prefs.edit().putString("device_id", value).apply()

    val deviceName: String
        get() = "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}"

    val osVersion: String
        get() = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

    var isConnected: Boolean
        get() = prefs.getBoolean("is_connected", false)
        set(value) = prefs.edit().putBoolean("is_connected", value).apply()

    var lastSyncTimestamp: Long
        get() = prefs.getLong("last_sync_timestamp", 0L)
        set(value) = prefs.edit().putLong("last_sync_timestamp", value).apply()

    // Steps baseline per calendar day to compute midnight offset accurately
    fun getStepBaselineForToday(): Int {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val savedDate = prefs.getString("step_baseline_date", "")
        return if (savedDate == todayStr) {
            prefs.getInt("step_baseline_value", 0)
        } else {
            -1 // Baseline not established for today yet
        }
    }

    fun setStepBaselineForToday(hardwareStepCount: Int) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        prefs.edit()
            .putString("step_baseline_date", todayStr)
            .putInt("step_baseline_value", hardwareStepCount)
            .apply()
    }

    fun clearAuth() {
        prefs.edit()
            .remove("auth_token")
            .putBoolean("is_connected", false)
            .apply()
    }
}
