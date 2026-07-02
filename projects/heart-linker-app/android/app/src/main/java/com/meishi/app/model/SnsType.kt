package com.meishi.app.model

/**
 * SNSの種類。typeKeyはDB保存用、code はMessagePackスキーマのservice_type enum値。
 */
enum class SnsType(val typeKey: String, val displayName: String, val code: Int) {
    TWITTER("twitter", "X (Twitter)", 1),
    FACEBOOK("facebook", "Facebook", 2),
    LINE("line", "LINE", 3),
    WHATSAPP("whatsapp", "WhatsApp", 4),
    INSTAGRAM("instagram", "Instagram", 5),

    // 「それ以外」として下部に表示する、それらしい名前の候補
    TIKTOK("tiktok", "TikTok", 6),
    YOUTUBE("youtube", "YouTube", 7),
    GITHUB("github", "GitHub", 8),
    LINKEDIN("linkedin", "LinkedIn", 9),
    WEBSITE("website", "Webサイト・その他URL", 10),
    OTHER("other", "その他", 0);

    companion object {
        val primary = listOf(TWITTER, FACEBOOK, LINE, WHATSAPP, INSTAGRAM)
        val others = listOf(TIKTOK, YOUTUBE, GITHUB, LINKEDIN, WEBSITE, OTHER)

        fun fromKey(key: String): SnsType =
            values().firstOrNull { it.typeKey == key } ?: OTHER

        fun fromCode(code: Int): SnsType =
            values().firstOrNull { it.code == code } ?: OTHER
    }
}
