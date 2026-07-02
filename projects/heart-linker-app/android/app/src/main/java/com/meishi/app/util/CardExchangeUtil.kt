package com.meishi.app.util

import android.content.Context
import com.meishi.app.model.Contact
import com.meishi.app.model.Profile
import com.meishi.app.model.SnsAccount
import com.meishi.app.model.SnsType

object CardExchangeUtil {

    /** 自分のプロフィールから送信用のCardPayloadを作る */
    fun buildPayload(profile: Profile): CardPayload {
        val iconBytes = ImageUtil.pathToBytes(profile.iconPath)
        return CardPayload(
            name = profile.name,
            mail = profile.email,
            tel = profile.phone,
            address = profile.address,
            iconMime = if (iconBytes != null) "image/jpeg" else null,
            iconData = iconBytes,
            accounts = profile.snsAccounts().map { sns ->
                CardPayload.AccountItem(
                    serviceName = sns.displayLabel(),
                    serviceType = sns.type.code,
                    accountUrl = sns.accountUrl ?: sns.value.takeIf { it.startsWith("http") },
                    accountId = sns.accountId ?: sns.value.takeUnless { it.startsWith("http") },
                    sortOrder = sns.sortOrder
                )
            }
        )
    }

    /** 受信したCardPayloadを連絡先として保存する */
    fun saveAsContact(context: Context, payload: CardPayload): Contact {
        val iconPath = ImageUtil.bytesToPath(context, payload.iconData)
        val contact = Contact(
            name = payload.name,
            email = payload.mail,
            phone = payload.tel,
            address = payload.address,
            iconPath = iconPath,
            receivedAt = payload.sentAt * 1000
        )
        contact.save()
        payload.accounts.forEach { acc ->
            val value = acc.accountId ?: acc.accountUrl ?: ""
            SnsAccount.newForContact(
                contactId = contact.id,
                type = SnsType.fromCode(acc.serviceType),
                value = value,
                sortOrder = acc.sortOrder,
                serviceName = acc.serviceName,
                accountUrl = acc.accountUrl,
                accountId = acc.accountId
            ).save()
        }
        return contact
    }
}
