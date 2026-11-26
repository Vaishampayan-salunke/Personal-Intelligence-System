package com.knowthyself.network

import com.knowthyself.model.MobileConnectRequest
import com.knowthyself.model.MobileDeviceResponse
import com.knowthyself.model.MobileStatusResponse
import com.knowthyself.model.MobileSyncPayload
import com.knowthyself.model.MobileSyncResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {

    @POST("/api/mobile/connect")
    suspend fun connectDevice(
        @Body request: MobileConnectRequest
    ): Response<MobileDeviceResponse>

    @POST("/api/mobile/sync")
    suspend fun syncMetrics(
        @Body payload: MobileSyncPayload
    ): Response<MobileSyncResponse>

    @GET("/api/mobile/status")
    suspend fun getStatus(): Response<MobileStatusResponse>
}
