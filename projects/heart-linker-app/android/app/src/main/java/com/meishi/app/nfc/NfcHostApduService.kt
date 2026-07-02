package com.meishi.app.nfc

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * NFCタップしてきた相手の端末(リーダーモード)に、現在広告中のNearbyセッショントークンを返す。
 * 名刺データそのものはNFC経由では送らず、Bluetooth/Wi-Fi(Nearby Connections)への
 * ハンドオーバーに使う短いトークンだけを返す軽量な実装。
 */
class NfcHostApduService : HostApduService() {

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        // SELECT AID コマンドかどうかは厳密にパースせず、トークンがあれば常に返す簡易実装
        val token = NfcAdvertiseBridge.currentToken
        return if (token != null) {
            token.toByteArray(Charsets.US_ASCII) + STATUS_OK
        } else {
            STATUS_NOT_FOUND
        }
    }

    override fun onDeactivated(reason: Int) {
        // タップが離れた場合は何もしない(トークンはSend画面を抜けるまで維持)
    }

    companion object {
        private val STATUS_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val STATUS_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
    }
}
