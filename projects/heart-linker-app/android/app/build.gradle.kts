plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.meishi.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.meishi.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // QR code generation
    implementation("com.google.zxing:core:3.5.3")

    // MessagePack (送受信ペイロードのシリアライズ)
    implementation("org.msgpack:msgpack-core:0.9.8")

    // Nearby Connections (Bluetooth/Wi-Fi近接通信)
    implementation("com.google.android.gms:play-services-nearby:19.3.0")

    // NFC handover用トークンのHCE実装はNFCサービスクラスで標準SDKのみ使用

    // QR code scanning (CameraX + ML Kit)
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("androidx.compose.runtime:runtime-livedata:1.6.8")

    // Image loading for icon picking
    implementation("io.coil-kt:coil-compose:2.6.0")

    implementation("androidx.activity:activity-ktx:1.9.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
