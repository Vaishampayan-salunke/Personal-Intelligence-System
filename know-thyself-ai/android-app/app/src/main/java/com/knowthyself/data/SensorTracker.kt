package com.knowthyself.data

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SensorTracker(private val context: Context, private val prefs: PreferencesManager) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val stepCounterSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    private val _liveSteps = MutableStateFlow(0)
    val liveSteps: StateFlow<Int> = _liveSteps.asStateFlow()

    private var isListening = false

    fun startTracking() {
        if (isListening || stepCounterSensor == null) return
        sensorManager?.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI)
        isListening = true
    }

    fun stopTracking() {
        if (!isListening) return
        sensorManager?.unregisterListener(this)
        isListening = false
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

        val totalHardwareSteps = event.values[0].toInt()
        val baseline = prefs.getStepBaselineForToday()

        val calculatedSteps: Int = if (baseline == -1 || totalHardwareSteps < baseline) {
            // New day or phone rebooted: initialize today's baseline to current hardware steps
            prefs.setStepBaselineForToday(totalHardwareSteps)
            0
        } else {
            totalHardwareSteps - baseline
        }

        _liveSteps.value = calculatedSteps
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    fun getEstimatedSteps(): Int = _liveSteps.value
}
