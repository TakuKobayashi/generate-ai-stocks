package com.meishi.app.nfc

/**
 * NFCリーダーモードでHCE端末からトークンを読み取るためのAPDUユーティリティ。
 * AIDは自前のproprietary AID(F0始まり)を使用。
 */
object NfcApdu {
    // F0 + 任意の6バイト。実運用では正式なRIDを取得して使うのが望ましいが、
    // 自社アプリ間の私的な通信用途としてはF0始まりのproprietary AIDで問題ない。
    const val AID_HEX = "F0010203040506"

    fun selectAidCommand(): ByteArray {
        val aidBytes = hexToBytes(AID_HEX)
        return byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, aidBytes.size.toByte()) + aidBytes + byteArrayOf(0x00)
    }

    /** レスポンスがOK(末尾90 00)であればトークン文字列を返す */
    fun parseTokenResponse(response: ByteArray?): String? {
        if (response == null || response.size < 2) return null
        val statusOk = response[response.size - 2] == 0x90.toByte() && response[response.size - 1] == 0x00.toByte()
        if (!statusOk) return null
        val payload = response.copyOfRange(0, response.size - 2)
        return String(payload, Charsets.US_ASCII)
    }

    private fun hexToBytes(hex: String): ByteArray {
        val clean = hex.replace(" ", "")
        return ByteArray(clean.length / 2) { i ->
            clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }
}
