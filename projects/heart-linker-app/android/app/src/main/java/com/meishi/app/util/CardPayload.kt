package com.meishi.app.util

import org.msgpack.core.MessagePack
import org.msgpack.core.MessageUnpacker
import java.util.UUID

/**
 * QR/Nearby/NFC経由で送受信する名刺データ。MessagePackでシリアライズする。
 *
 * スキーマ:
 * {
 *   type: 1 (連絡先交換),
 *   version: 1,
 *   device_id: string,
 *   sent_at: long(unix seconds),
 *   icon: { mime: string, data: bytes } | nil,
 *   data: {
 *     name, mail, tel, address: string,
 *     accounts: [ { service_name, service_type:int, account_url:string?, account_id:string?, sort_order:int } ]
 *   }
 * }
 */
data class CardPayload(
    val deviceId: String = UUID.randomUUID().toString(),
    val sentAt: Long = System.currentTimeMillis() / 1000,
    val name: String,
    val mail: String,
    val tel: String,
    val address: String,
    val iconMime: String? = null,
    val iconData: ByteArray? = null,
    val accounts: List<AccountItem>
) {
    data class AccountItem(
        val serviceName: String,
        val serviceType: Int,
        val accountUrl: String?,
        val accountId: String?,
        val sortOrder: Int
    )

    fun toMessagePack(): ByteArray {
        val packer = MessagePack.newDefaultBufferPacker()
        packer.packMapHeader(5)

        packer.packString("type"); packer.packInt(TYPE_CONTACT_EXCHANGE)
        packer.packString("version"); packer.packInt(SCHEMA_VERSION)
        packer.packString("device_id"); packer.packString(deviceId)
        packer.packString("sent_at"); packer.packLong(sentAt)

        packer.packString("icon")
        if (iconData != null && iconMime != null) {
            packer.packMapHeader(2)
            packer.packString("mime"); packer.packString(iconMime)
            packer.packString("data"); packer.packBinaryHeader(iconData.size); packer.writePayload(iconData)
        } else {
            packer.packNil()
        }

        packer.packString("data")
        packer.packMapHeader(5)
        packer.packString("name"); packer.packString(name)
        packer.packString("mail"); packer.packString(mail)
        packer.packString("tel"); packer.packString(tel)
        packer.packString("address"); packer.packString(address)
        packer.packString("accounts")
        packer.packArrayHeader(accounts.size)
        accounts.forEach { acc ->
            packer.packMapHeader(5)
            packer.packString("service_name"); packer.packString(acc.serviceName)
            packer.packString("service_type"); packer.packInt(acc.serviceType)
            packer.packString("account_url")
            if (acc.accountUrl != null) packer.packString(acc.accountUrl) else packer.packNil()
            packer.packString("account_id")
            if (acc.accountId != null) packer.packString(acc.accountId) else packer.packNil()
            packer.packString("sort_order"); packer.packInt(acc.sortOrder)
        }

        packer.close()
        return packer.toByteArray()
    }

    companion object {
        const val TYPE_CONTACT_EXCHANGE = 1
        const val SCHEMA_VERSION = 1

        fun fromMessagePack(bytes: ByteArray): CardPayload {
            val unpacker = MessagePack.newDefaultUnpacker(bytes)
            var deviceId = UUID.randomUUID().toString()
            var sentAt = System.currentTimeMillis() / 1000
            var iconMime: String? = null
            var iconData: ByteArray? = null
            var name = ""; var mail = ""; var tel = ""; var address = ""
            val accounts = mutableListOf<AccountItem>()

            val topSize = unpacker.unpackMapHeader()
            repeat(topSize) {
                when (unpacker.unpackString()) {
                    "type" -> unpacker.unpackInt()
                    "version" -> unpacker.unpackInt()
                    "device_id" -> deviceId = unpacker.unpackString()
                    "sent_at" -> sentAt = unpacker.unpackLong()
                    "icon" -> {
                        if (unpacker.tryUnpackNil()) {
                            // アイコンなし
                        } else {
                            val iconSize = unpacker.unpackMapHeader()
                            repeat(iconSize) {
                                when (unpacker.unpackString()) {
                                    "mime" -> iconMime = unpacker.unpackString()
                                    "data" -> {
                                        val len = unpacker.unpackBinaryHeader()
                                        iconData = unpacker.readPayload(len)
                                    }
                                    else -> unpacker.skipValue()
                                }
                            }
                        }
                    }
                    "data" -> {
                        val dataSize = unpacker.unpackMapHeader()
                        repeat(dataSize) {
                            when (unpacker.unpackString()) {
                                "name" -> name = unpacker.unpackString()
                                "mail" -> mail = unpacker.unpackString()
                                "tel" -> tel = unpacker.unpackString()
                                "address" -> address = unpacker.unpackString()
                                "accounts" -> {
                                    val count = unpacker.unpackArrayHeader()
                                    repeat(count) {
                                        accounts.add(readAccount(unpacker))
                                    }
                                }
                                else -> unpacker.skipValue()
                            }
                        }
                    }
                    else -> unpacker.skipValue()
                }
            }
            unpacker.close()

            return CardPayload(
                deviceId = deviceId, sentAt = sentAt, name = name, mail = mail, tel = tel,
                address = address, iconMime = iconMime, iconData = iconData, accounts = accounts
            )
        }

        private fun readAccount(unpacker: MessageUnpacker): AccountItem {
            var serviceName = ""; var serviceType = 0
            var accountUrl: String? = null; var accountId: String? = null; var sortOrder = 0
            val size = unpacker.unpackMapHeader()
            repeat(size) {
                when (unpacker.unpackString()) {
                    "service_name" -> serviceName = unpacker.unpackString()
                    "service_type" -> serviceType = unpacker.unpackInt()
                    "account_url" -> accountUrl = if (unpacker.tryUnpackNil()) null else unpacker.unpackString()
                    "account_id" -> accountId = if (unpacker.tryUnpackNil()) null else unpacker.unpackString()
                    "sort_order" -> sortOrder = unpacker.unpackInt()
                    else -> unpacker.skipValue()
                }
            }
            return AccountItem(serviceName, serviceType, accountUrl, accountId, sortOrder)
        }
    }
}
