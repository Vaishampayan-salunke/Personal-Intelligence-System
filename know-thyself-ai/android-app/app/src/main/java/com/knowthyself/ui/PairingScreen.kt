package com.knowthyself.ui

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import android.view.ViewGroup
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.knowthyself.data.PreferencesManager
import com.knowthyself.model.PairingApproveRequest
import com.knowthyself.model.PairingClaimRequest
import com.knowthyself.model.PairingClaimResponse
import com.knowthyself.network.RetrofitClient
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

@Composable
fun PairingScreen(
    prefs: PreferencesManager,
    onPairingSuccess: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // 0 = Scan QR Code, 1 = Enter 6-digit Code
    var selectedTab by remember { mutableIntStateOf(0) }
    var pairingCode by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf(prefs.serverUrl) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Approval dialog state
    var pendingApprovalData by remember { mutableStateOf<PairingClaimResponse?>(null) }
    var isApproving by remember { mutableStateOf(false) }

    // Camera permission for QR scanning
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            errorMessage = "Camera permission is required to scan the pairing QR code."
        }
    }

    // Function to claim pairing session (used by both QR scan and manual code)
    fun handleClaim(
        pairingId: String? = null,
        pairingToken: String? = null,
        code: String? = null
    ) {
        if (isLoading || isApproving) return
        isLoading = true
        errorMessage = null
        prefs.serverUrl = serverUrl

        scope.launch {
            try {
                val api = RetrofitClient.getApiService(prefs)
                val claimReq = PairingClaimRequest(
                    pairingId = pairingId,
                    pairingToken = pairingToken,
                    pairingCode = code,
                    deviceId = prefs.deviceId,
                    deviceName = prefs.deviceName,
                    model = prefs.deviceName,
                    osVersion = prefs.osVersion
                )

                val response = api.claimPairing(claimReq)
                if (response.isSuccessful && response.body() != null) {
                    val claimRes = response.body()!!
                    // Prompt explicit approval
                    pendingApprovalData = claimRes
                } else {
                    val errBody = response.errorBody()?.string() ?: ""
                    errorMessage = if (errBody.contains("expired")) {
                        "This pairing session has expired (2-minute limit). Please regenerate a new QR code on your website."
                    } else if (errBody.contains("Invalid")) {
                        "Invalid pairing credentials. Please check the QR code or 6-digit code."
                    } else {
                        "Pairing claim failed (${response.code()}). Please try again."
                    }
                }
            } catch (e: Exception) {
                errorMessage = "Connection error: ${e.localizedMessage ?: "Unable to reach server"}"
            } finally {
                isLoading = false
            }
        }
    }

    // Function to approve pairing
    fun handleApprove(claimData: PairingClaimResponse, approved: Boolean) {
        if (isApproving) return
        isApproving = true
        errorMessage = null

        scope.launch {
            try {
                val api = RetrofitClient.getApiService(prefs)
                val approveReq = PairingApproveRequest(
                    pairingId = claimData.pairingId,
                    deviceId = prefs.deviceId,
                    deviceName = prefs.deviceName,
                    model = prefs.deviceName,
                    osVersion = prefs.osVersion,
                    approved = approved
                )

                val response = api.approvePairing(approveReq)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (approved && body.status == "connected") {
                        prefs.authToken = body.accessToken
                        prefs.isConnected = true
                        pendingApprovalData = null
                        onPairingSuccess()
                    } else {
                        pendingApprovalData = null
                    }
                } else {
                    errorMessage = "Approval failed. The session may have expired."
                    pendingApprovalData = null
                }
            } catch (e: Exception) {
                errorMessage = "Network error during approval: ${e.localizedMessage}"
                pendingApprovalData = null
            } finally {
                isApproving = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            elevation = CardDefaults.cardElevation(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .background(Color(0xFF6366F1).copy(alpha = 0.2f), shape = RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = null,
                            tint = Color(0xFF818CF8),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Connect to Know Thyself",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Pair this phone to your web dashboard",
                            fontSize = 11.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Tab Switcher: [Scan QR Code] | [Enter Pairing Code]
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0F172A), shape = RoundedCornerShape(14.dp))
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(
                                if (selectedTab == 0) Color(0xFF4F46E5) else Color.Transparent,
                                shape = RoundedCornerShape(10.dp)
                            )
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        TextButton(
                            onClick = {
                                selectedTab = 0
                                if (!hasCameraPermission) {
                                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                }
                            },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Icon(
                                Icons.Default.CameraAlt,
                                contentDescription = null,
                                tint = if (selectedTab == 0) Color.White else Color(0xFF94A3B8),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                "Scan QR Code",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (selectedTab == 0) Color.White else Color(0xFF94A3B8)
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(
                                if (selectedTab == 1) Color(0xFF4F46E5) else Color.Transparent,
                                shape = RoundedCornerShape(10.dp)
                            )
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        TextButton(
                            onClick = { selectedTab = 1 },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Icon(
                                Icons.Default.Dialpad,
                                contentDescription = null,
                                tint = if (selectedTab == 1) Color.White else Color(0xFF94A3B8),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                "Enter Code",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (selectedTab == 1) Color.White else Color(0xFF94A3B8)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Error alert
                if (errorMessage != null) {
                    Surface(
                        color = Color(0xFFEF4444).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.5f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFF87171), modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = errorMessage!!, color = Color(0xFFF87171), fontSize = 11.sp)
                        }
                    }
                }

                // TAB 0: QR Code Scanner
                if (selectedTab == 0) {
                    if (hasCameraPermission) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(260.dp)
                                .background(Color.Black, shape = RoundedCornerShape(18.dp))
                                .border(2.dp, Color(0xFF6366F1), shape = RoundedCornerShape(18.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            CameraQRScanner(
                                onQRCodeDetected = { qrString ->
                                    try {
                                        val gson = Gson()
                                        val obj = gson.fromJson(qrString, JsonObject::class.java)
                                        if (obj.has("pairing_id") && obj.has("pairing_token")) {
                                            val pId = obj.get("pairing_id").asString
                                            val pToken = obj.get("pairing_token").asString
                                            if (obj.has("server_url")) {
                                                serverUrl = obj.get("server_url").asString
                                            }
                                            handleClaim(pairingId = pId, pairingToken = pToken)
                                        } else {
                                            errorMessage = "Scanned QR code is not a valid Know Thyself pairing token."
                                        }
                                    } catch (e: Exception) {
                                        errorMessage = "Unable to parse QR payload."
                                    }
                                }
                            )

                            // Visual Scanning Target Overlay
                            Box(
                                modifier = Modifier
                                    .size(180.dp)
                                    .border(2.dp, Color(0xFF818CF8), shape = RoundedCornerShape(16.dp))
                            )

                            if (isLoading) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(Color.Black.copy(alpha = 0.7f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = Color(0xFF818CF8))
                                }
                            }
                        }
                        Text(
                            text = "Point camera at the pairing QR code displayed in Settings → Device Integration on your computer.",
                            fontSize = 11.sp,
                            color = Color(0xFF94A3B8),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(vertical = 30.dp)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "Camera permission is required to scan pairing QR codes.",
                                fontSize = 12.sp,
                                color = Color(0xFF94A3B8),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
                            ) {
                                Text("Grant Camera Permission")
                            }
                        }
                    }
                }

                // TAB 1: 6-Digit Manual Pairing Code
                if (selectedTab == 1) {
                    Column(modifier = Modifier.fillMaxWidth()) {
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

                        Spacer(modifier = Modifier.height(14.dp))

                        OutlinedTextField(
                            value = pairingCode,
                            onValueChange = {
                                if (it.length <= 6) pairingCode = it.filter { c -> c.isDigit() }
                            },
                            label = { Text("6-Digit Manual Pairing Code") },
                            placeholder = { Text("e.g. 583921", color = Color(0xFF64748B)) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            leadingIcon = {
                                Icon(Icons.Default.Pin, contentDescription = null, tint = Color(0xFF818CF8))
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFF6366F1),
                                unfocusedBorderColor = Color(0xFF475569)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (pairingCode.length != 6) {
                                    errorMessage = "Please enter all 6 digits of your pairing code."
                                    return@Button
                                }
                                handleClaim(code = pairingCode)
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            enabled = !isLoading
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                            } else {
                                Text("Connect Device", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------
    // EXPLICIT DEVICE APPROVAL DIALOG
    // -------------------------------------------------------------
    if (pendingApprovalData != null) {
        val claim = pendingApprovalData!!
        AlertDialog(
            onDismissRequest = {
                if (!isApproving) {
                    handleApprove(claim, approved = false)
                }
            },
            containerColor = Color(0xFF1E293B),
            shape = RoundedCornerShape(24.dp),
            icon = {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .background(Color(0xFF10B981).copy(alpha = 0.2f), shape = CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Security,
                        contentDescription = null,
                        tint = Color(0xFF34D399),
                        modifier = Modifier.size(28.dp)
                    )
                }
            },
            title = {
                Text(
                    text = "Approve Connection",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Do you want to connect this device to Know Thyself AI?",
                        fontSize = 13.sp,
                        color = Color(0xFFCBD5E1),
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Surface(
                        color = Color(0xFF0F172A),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(text = "CONNECTING ACCOUNT", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF818CF8))
                            Text(text = claim.accountName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = claim.accountMaskedEmail, fontSize = 12.sp, color = Color(0xFF94A3B8))

                            Spacer(modifier = Modifier.height(8.dp))
                            Divider(color = Color(0xFF334155))
                            Spacer(modifier = Modifier.height(8.dp))

                            Text(text = "DEVICE NAME", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF818CF8))
                            Text(text = prefs.deviceName, fontSize = 13.sp, color = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Real-time steps, screen time & sleep data from this phone will sync to this account.",
                        fontSize = 11.sp,
                        color = Color(0xFF64748B),
                        textAlign = TextAlign.Center
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { handleApprove(claim, approved = true) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isApproving
                ) {
                    if (isApproving) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp))
                    } else {
                        Text("Approve & Connect", fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { handleApprove(claim, approved = false) },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF94A3B8)),
                    enabled = !isApproving
                ) {
                    Text("Cancel")
                }
            }
        )
    }
}

// -------------------------------------------------------------
// CameraX + ML Kit Barcode Analyzer Component
// -------------------------------------------------------------
@OptIn(ExperimentalGetImage::class)
@Composable
fun CameraQRScanner(
    onQRCodeDetected: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    var hasDetected by remember { mutableStateOf(false) }

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            }

            val executor = Executors.newSingleThreadExecutor()
            val scanner = BarcodeScanning.getClient()

            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()

                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                imageAnalysis.setAnalyzer(executor) { imageProxy ->
                    val mediaImage = imageProxy.image
                    if (mediaImage != null && !hasDetected) {
                        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                        scanner.process(image)
                            .addOnSuccessListener { barcodes ->
                                for (barcode in barcodes) {
                                    if (barcode.valueType == Barcode.TYPE_TEXT || barcode.valueType == Barcode.TYPE_URL) {
                                        val rawValue = barcode.rawValue
                                        if (!rawValue.isNullOrBlank() && !hasDetected) {
                                            hasDetected = true
                                            onQRCodeDetected(rawValue)
                                            break
                                        }
                                    }
                                }
                            }
                            .addOnFailureListener {
                                Log.e("CameraQRScanner", "ML Kit barcode scan failure", it)
                            }
                            .addOnCompleteListener {
                                imageProxy.close()
                            }
                    } else {
                        imageProxy.close()
                    }
                }

                try {
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalysis
                    )
                } catch (exc: Exception) {
                    Log.e("CameraQRScanner", "Use case binding failed", exc)
                }
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        },
        modifier = Modifier.fillMaxSize()
    )
}
