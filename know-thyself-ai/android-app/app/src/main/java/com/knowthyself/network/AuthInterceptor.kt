package com.knowthyself.network

import com.knowthyself.data.PreferencesManager
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val prefs: PreferencesManager) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()

        val token = prefs.authToken
        if (!token.isNullOrBlank()) {
            builder.header("Authorization", "Bearer $token")
        }

        builder.header("Content-Type", "application/json")
        builder.header("Accept", "application/json")

        return chain.proceed(builder.build())
    }
}
