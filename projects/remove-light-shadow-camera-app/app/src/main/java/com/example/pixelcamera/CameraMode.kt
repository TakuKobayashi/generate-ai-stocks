package com.example.pixelcamera

enum class CameraMode(val label: String) {
    PHOTO("写真"),
    PORTRAIT("ポートレート"),
    NIGHT("夜景"),
    PANORAMA("パノラマ"),
    SLOW_MOTION("スロー"),
    LIGHT_REMOVAL("光除去"),
    SHADOW_REMOVAL("影除去")
}

enum class FlashMode { OFF, AUTO, ON, TORCH }
enum class TimerMode(val seconds: Int) { OFF(0), THREE(3), TEN(10) }
enum class AspectRatio(val label: String) { RATIO_4_3("4:3"), RATIO_16_9("16:9"), RATIO_1_1("1:1") }
enum class WhiteBalance(val label: String) {
    AUTO("AUTO"), SUNNY("晴れ"), CLOUDY("曇り"),
    FLUORESCENT("蛍光灯"), INCANDESCENT("電球"), SHADE("日陰")
}
enum class HdrMode { AUTO, ON, OFF }
