# ProGuard rules for Know Thyself AI Android Companion
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
