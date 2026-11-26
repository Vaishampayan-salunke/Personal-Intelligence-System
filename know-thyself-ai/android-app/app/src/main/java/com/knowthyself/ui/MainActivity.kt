package com.knowthyself.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.core.content.ContextCompat
import com.knowthyself.data.HealthConnectTracker
import com.knowthyself.data.PreferencesManager
import com.knowthyself.data.SensorTracker
import com.knowthyself.data.UsageTracker

class MainActivity : ComponentActivity() {

    private lateinit var prefs: PreferencesManager
    private lateinit var sensorTracker: SensorTracker
    private lateinit var usageTracker: UsageTracker
    private lateinit var healthTracker: HealthConnectTracker

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            sensorTracker.startTracking()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = PreferencesManager(this)
        sensorTracker = SensorTracker(this, prefs)
        usageTracker = UsageTracker(this)
        healthTracker = HealthConnectTracker(this)

        checkAndRequestPermissions()

        setContent {
            var isConnected by remember { mutableStateOf(prefs.isConnected && !prefs.authToken.isNullOrBlank()) }

            if (isConnected) {
                DashboardScreen(
                    prefs = prefs,
                    sensorTracker = sensorTracker,
                    usageTracker = usageTracker,
                    healthTracker = healthTracker,
                    onDisconnect = {
                        isConnected = false
                    }
                )
            } else {
                PairingScreen(
                    prefs = prefs,
                    onPairingSuccess = {
                        isConnected = true
                    }
                )
            }
        }
    }

    private fun checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.ACTIVITY_RECOGNITION
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissionLauncher.launch(Manifest.permission.ACTIVITY_RECOGNITION)
            } else {
                sensorTracker.startTracking()
            }
        } else {
            sensorTracker.startTracking()
        }
    }

    override fun onResume() {
        super.onResume()
        if (prefs.isConnected) {
            sensorTracker.startTracking()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        sensorTracker.stopTracking()
    }
}
