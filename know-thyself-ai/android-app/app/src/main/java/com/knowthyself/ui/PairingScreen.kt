package com.knowthyself.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.knowthyself.data.PreferencesManager
import com.knowthyself.model.MobileConnectRequest
import com.knowthyself.network.RetrofitClient
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairingScreen(
    prefs: PreferencesManager,
    onPairingSuccess: () -> Unit
) {
    var pairingCode by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf(prefs.serverUrl) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            elevation = CardDefaults.cardElevation(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.CloudSync,
                    contentDescription = null,
                    tint = Color(0xFF818CF8),
                    modifier = Modifier.size(56.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Know Thyself AI",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Text(
                    text = "Pair your phone to sync real-time steps, screen time & sleep to your dashboard.",
                    fontSize = 13.sp,
                    color = Color(0xFF94A3B8),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
                )

                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    label = { Text("Server Backend URL") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF6366F1),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = pairingCode,
                    onValueChange = {
                        if (it.length <= 6) pairingCode = it.filter { char -> char.isDigit() }
                    },
                    label = { Text("6-Digit Pairing Code") },
                    placeholder = { Text("e.g. 583921", color = Color(0xFF64748B)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    leadingIcon = {
                        Icon(Icons.Default.QrCode, contentDescription = null, tint = Color(0xFF818CF8))
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF6366F1),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = Color(0xFFF87171),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 10.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = {
                        if (pairingCode.length != 6) {
                            errorMessage = "Please enter all 6 digits of the pairing code."
                            return@Button
                        }
                        isLoading = true
                        errorMessage = null
                        prefs.serverUrl = serverUrl

                        scope.launch {
                            try {
                                val api = RetrofitClient.getApiService(prefs)
                                val response = api.connectDevice(
                                    MobileConnectRequest(
                                        deviceId = prefs.deviceId,
                                        deviceName = prefs.deviceName,
                                        model = prefs.deviceName,
                                        osVersion = prefs.osVersion,
                                        pairingCode = pairingCode
                                    )
                                )
                                if (response.isSuccessful && response.body() != null) {
                                    val body = response.body()!!
                                    prefs.authToken = body.accessToken
                                    prefs.isConnected = true
                                    onPairingSuccess()
                                } else {
                                    errorMessage = "Pairing failed. Please verify code from your dashboard."
                                }
                            } catch (e: Exception) {
                                errorMessage = "Network error: ${e.localizedMessage ?: "Could not reach server"}"
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text("Connect Phone", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}
