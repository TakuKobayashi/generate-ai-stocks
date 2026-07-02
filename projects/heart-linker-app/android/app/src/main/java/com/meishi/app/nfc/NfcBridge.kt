package com.meishi.app.nfc

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

/**
 * 送信側: HCE(NfcHostApduService)が応答するセッショントークンを保持する。
 * 受信側: NFCリーダーモードで読み取ったトークンをUIへ流す。
 *
 * 実際の名刺データそのものはNFCでは送らず、Nearby Connectionsへのハンドオーバー用の
 * 短いトークン(セッションID)だけをやり取りする。
 */
object NfcAdvertiseBridge {
    /** 自分が現在広告中のセッショントークン(HCEが応答に使う) */
    @Volatile
    var currentToken: String? = null
}

object NfcReaderBus {
    private val _tokens = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val tokens: SharedFlow<String> = _tokens

    suspend fun emit(token: String) {
        _tokens.emit(token)
    }
}
