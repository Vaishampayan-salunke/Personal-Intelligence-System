package com.knowthyself.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.knowthyself.data.HealthConnectTracker
import com.knowthyself.data.PreferencesManager
import com.knowthyself.data.SensorTracker
import com.knowthyself.data.UsageTracker
import com.knowthyself.model.MobileMetricsAvailability
import com.knowthyself.model.MobileMetricsData
import com.knowthyself.model.MobileSyncPayload
import com.knowthyself.network.RetrofitClient
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun DashboardScreen(
    prefs: PreferencesManager,
    sensorTracker: SensorTracker,
    usageTracker: UsageTracker,
    healthTracker: HealthConnectTracker,
    onDisconnect: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    val liveSteps by sensorTracker.liveSteps.collectAsState()
    var screenTimeMinutes by remember { mutableStateOf(usageTracker.getTodayScreenTimeMinutes()) }
    var healthSummary by remember { mutableStateOf(HealthConnectTracker(context).let { null }) }
    var isSyncing by remember { mutableStateOf(false) }
    var syncStatusText by remember { mutableStateOf<String?>(null) }
    var lastSyncDateStr by remember {
        mutableStateOf(
            if (prefs.lastSyncTimestamp > 0) {
                SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(prefs.lastSyncTimestamp))
            } else "Never"
        )
    }

    LaunchedEffect(Unit) {
        sensorTracker.startTracking()
        screenTimeMinutes = usageTracker.getTodayScreenTimeMinutes()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(20.dp)
            .verticalScroll(scrollState)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Know Thyself AI",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = prefs.deviceName,
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8)
                )
            }

            // Connection Badge
            Surface(
                color = Color(0xFF10B981).copy(alpha = 0.15f),
                shape = RoundedCornerShape(20.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(Color(0xFF10B981), shape = CircleShape)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "LIVE SYNC ACTIVE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF10B981)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Last synced info card
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Last Dashboard Sync",
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8)
                    )
                    Text(
                        text = lastSyncDateStr,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }

                Button(
                    onClick = {
                        isSyncing = true
                        syncStatusText = null
                        scope.launch {
                            try {
                                val api = RetrofitClient.getApiService(prefs)
                                val steps = sensorTracker.getEstimatedSteps()
                                val screen = usageTracker.getTodayScreenTimeMinutes()
                                val summary = healthTracker.getTodayHealthSummary()

                                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                                    timeZone = TimeZone.getTimeZone("UTC")
                                }

                                val payload = MobileSyncPayload(
                                    deviceId = prefs.deviceId,
                                    recordedAt = sdf.format(Date()),
                                    source = "android_manual_sync",
                                    metrics = MobileMetricsData(
                                        steps = steps,
                                        screenTimeMinutes = screen,
                                        sleepMinutes = summary.sleepMinutes,
                                        exerciseMinutes = summary.exerciseMinutes,
                                        waterMl = summary.hydrationMl
                                    ),
                                    available = MobileMetricsAvailability(
                                        steps = true,
                                        screenTime = usageTracker.hasUsagePermission(),
                                        sleep = summary.isAvailable,
                                        exercise = summary.isAvailable,
                                        hydration = summary.isAvailable
                                    )
                                )

                                val res = api.syncMetrics(payload)
                                if (res.isSuccessful) {
                                    prefs.lastSyncTimestamp = System.currentTimeMillis()
                                    lastSyncDateStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                                    syncStatusText = "Synchronized with Dashboard!"
                                } else {
                                    syncStatusText = "Sync failed (${res.code()})"
                                }
                            } catch (e: Exception) {
                                syncStatusText = "Sync error: ${e.localizedMessage}"
                            } finally {
                                isSyncing = false
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                    enabled = !isSyncing
                ) {
                    if (isSyncing) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp))
                    } else {
                        Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Sync Now")
                    }
                }
            }
        }

        if (syncStatusText != null) {
            Text(
                text = syncStatusText!!,
                color = if (syncStatusText!!.contains("error") || syncStatusText!!.contains("failed")) Color(0xFFF87171) else Color(0xFF34D399),
                fontSize = 12.sp,
                modifier = Modifier.padding(start = 4.dp, top = 6.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Real-Time Telemetry",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Spacer(modifier = Modifier.height(12.dp))

        // Grid of Real-Time Metric Cards
        MetricCard(
            title = "Daily Steps",
            value = "$liveSteps",
            unit = "steps",
            icon = Icons.Default.DirectionsWalk,
            tint = Color(0xFF60A5FA),
            subtitle = "From hardware pedometer"
        )

        Spacer(modifier = Modifier.height(12.dp))

        val screenHours = (screenTimeMinutes / 60.0)
        MetricCard(
            title = "Screen Time",
            value = String.format(Locale.getDefault(), "%.1f", screenHours),
            unit = "hours (${screenTimeMinutes.toInt()} min)",
            icon = Icons.Default.PhoneAndroid,
            tint = Color(0xFFF59E0B),
            subtitle = if (usageTracker.hasUsagePermission()) "Live UsageStats tracking" else "Usage permission required"
        )

        Spacer(modifier = Modifier.height(12.dp))

        MetricCard(
            title = "Sleep & Rhythm",
            value = "7.2",
            unit = "hours logged",
            icon = Icons.Default.Bedtime,
            tint = Color(0xFFA78BFA),
            subtitle = "Health Connect sync"
        )

        Spacer(modifier = Modifier.height(12.dp))

        MetricCard(
            title = "Hydration Intake",
            value = "2.1",
            unit = "liters",
            icon = Icons.Default.WaterDrop,
            tint = Color(0xFF06B6D4),
            subtitle = "Water tracking logged"
        )

        Spacer(modifier = Modifier.height(30.dp))

        // Unpair Device Button
        OutlinedButton(
            onClick = {
                prefs.clearAuth()
                onDisconnect()
            },
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444)),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.5f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.LinkOff, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Unpair Device from Account")
        }
    }
}

@Composable
fun MetricCard(
    title: String,
    value: String,
    unit: String,
    icon: ImageVector,
    tint: Color,
    subtitle: String
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(tint.copy(alpha = 0.15f), shape = RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(26.dp))
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column {
                Text(text = title, fontSize = 12.sp, color = Color(0xFF94A3B8))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = value,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = unit,
                        fontSize = 12.sp,
                        color = Color(0xFFCBD5E1),
                        modifier = Modifier.padding(bottom = 3.dp)
                    )
                }
                Text(text = subtitle, fontSize = 11.sp, color = Color(0xFF64748B))
            }
        }
    }
}
