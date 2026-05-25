# whisper.cpp JNI クラスを難読化から除外
-keep class com.example.whispertranscriber.whisper.WhisperEngine {
    native <methods>;
    public *;
}

# Service / Activity を保持
-keep class com.example.whispertranscriber.service.TranscriptionService { *; }
-keep class com.example.whispertranscriber.MainActivity { *; }

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# ViewBinding
-keep class * implements androidx.viewbinding.ViewBinding {
    public static * inflate(android.view.LayoutInflater);
    public static * inflate(android.view.LayoutInflater, android.view.ViewGroup, boolean);
    public static * bind(android.view.View);
}

# Material3
-keep class com.google.android.material.** { *; }

# デバッグ用（リリース時はコメントアウト推奨）
# -dontobfuscate
