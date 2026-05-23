// apps/android/app/build.gradle.kts

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.wire)           // Square Wire for Protobuf
}

android {
    namespace         = "com.arpreview"
    compileSdk        = 34
    defaultConfig {
        applicationId = "com.arpreview"
        minSdk        = 26     // ARCore 最低要件
        targetSdk     = 34
        versionCode   = 1
        versionName   = "0.1.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.8" }
}

// ── Wire (Protobuf) ──────────────────────────────────────────────
wire {
    sourcePath {
        // monorepo root の proto/ を直接参照
        srcDir("../../../../proto")
    }
    kotlin {
        out("src/main/java")
    }
}

dependencies {
    // AR
    implementation("com.google.ar:core:1.43.0")

    // LiveKit
    implementation("io.livekit.android:livekit-android:2.7.0")

    // Protobuf (Wire runtime)
    implementation("com.squareup.wire:wire-runtime-jvm:4.9.9")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Jetpack Compose UI
    implementation(platform("androidx.compose:compose-bom:2024.04.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

    // DataStore (設定永続化)
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
}
