package com.knowthyself.network

import com.knowthyself.data.PreferencesManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    private var currentBaseUrl: String? = null
    private var apiServiceInstance: ApiService? = null

    fun getApiService(prefs: PreferencesManager): ApiService {
        val serverUrl = prefs.serverUrl.ifEmpty { "https://personal-intelligence-system-gamma.vercel.app" }
        val normalizedUrl = if (serverUrl.endsWith("/")) serverUrl else "$serverUrl/"

        if (apiServiceInstance != null && currentBaseUrl == normalizedUrl) {
            return apiServiceInstance!!
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(prefs))
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        currentBaseUrl = normalizedUrl
        val instance = retrofit.create(ApiService::class.java)
        apiServiceInstance = instance
        return instance
    }
}
