import Foundation
import UIKit

// MARK: - CardPayload

/// QR / Nearby / NFC 経由で送受信する名刺データ。
/// スキーマは Android 側と共通 (MessagePack v1)。
struct CardPayload {
    var deviceId: String
    var sentAt: Int64          // unix seconds
    var name: String
    var mail: String
    var tel: String
    var address: String
    var iconMime: String?
    var iconData: Data?
    var accounts: [AccountItem]

    struct AccountItem {
        var serviceName: String
        var serviceType: Int
        var accountUrl: String?
        var accountId: String?
        var sortOrder: Int
    }

    static let typeContactExchange = 1
    static let schemaVersion = 1

    // MARK: - Serialize

    func toMessagePack() -> Data {
        var p = MsgPackPacker()
        p.packMapHeader(5)

        p.packString("type");      p.packInt(CardPayload.typeContactExchange)
        p.packString("version");   p.packInt(CardPayload.schemaVersion)
        p.packString("device_id"); p.packString(deviceId)
        p.packString("sent_at");   p.packInt64(sentAt)

        p.packString("icon")
        if let mime = iconMime, let data = iconData {
            p.packMapHeader(2)
            p.packString("mime"); p.packString(mime)
            p.packString("data"); p.packBinary(data)
        } else {
            p.packNil()
        }

        p.packString("data")
        p.packMapHeader(5)
        p.packString("name");    p.packString(name)
        p.packString("mail");    p.packString(mail)
        p.packString("tel");     p.packString(tel)
        p.packString("address"); p.packString(address)
        p.packString("accounts")
        p.packArrayHeader(accounts.count)
        for acc in accounts {
            p.packMapHeader(5)
            p.packString("service_name"); p.packString(acc.serviceName)
            p.packString("service_type"); p.packInt(acc.serviceType)
            p.packString("account_url")
            if let u = acc.accountUrl { p.packString(u) } else { p.packNil() }
            p.packString("account_id")
            if let i = acc.accountId { p.packString(i) } else { p.packNil() }
            p.packString("sort_order");   p.packInt(acc.sortOrder)
        }

        return p.bytes()
    }

    // MARK: - Deserialize

    static func fromMessagePack(_ data: Data) throws -> CardPayload {
        var u = MsgPackUnpacker(data)
        var deviceId = UUID().uuidString
        var sentAt = Int64(Date().timeIntervalSince1970)
        var iconMime: String? = nil
        var iconData: Data? = nil
        var name = "", mail = "", tel = "", address = ""
        var accounts: [AccountItem] = []

        let topCount = u.unpackMapHeader()
        for _ in 0..<topCount {
            switch u.unpackString() {
            case "type":      _ = u.unpackInt()
            case "version":   _ = u.unpackInt()
            case "device_id": deviceId = u.unpackString()
            case "sent_at":   sentAt = u.unpackInt64()
            case "icon":
                if !u.unpackNil() {
                    let n = u.unpackMapHeader()
                    for _ in 0..<n {
                        switch u.unpackString() {
                        case "mime": iconMime = u.unpackString()
                        case "data": iconData = u.unpackBinary()
                        default:     u.skipValue()
                        }
                    }
                }
            case "data":
                let dn = u.unpackMapHeader()
                for _ in 0..<dn {
                    switch u.unpackString() {
                    case "name":    name = u.unpackString()
                    case "mail":    mail = u.unpackString()
                    case "tel":     tel  = u.unpackString()
                    case "address": address = u.unpackString()
                    case "accounts":
                        let ac = u.unpackArrayHeader()
                        for _ in 0..<ac { accounts.append(readAccount(&u)) }
                    default: u.skipValue()
                    }
                }
            default: u.skipValue()
            }
        }

        return CardPayload(deviceId: deviceId, sentAt: sentAt,
                           name: name, mail: mail, tel: tel, address: address,
                           iconMime: iconMime, iconData: iconData, accounts: accounts)
    }

    private static func readAccount(_ u: inout MsgPackUnpacker) -> AccountItem {
        var sn = "", st = 0
        var url: String? = nil, aid: String? = nil, order = 0
        let n = u.unpackMapHeader()
        for _ in 0..<n {
            switch u.unpackString() {
            case "service_name": sn  = u.unpackString()
            case "service_type": st  = u.unpackInt()
            case "account_url":  url = u.unpackNil() ? nil : u.unpackString()
            case "account_id":   aid = u.unpackNil() ? nil : u.unpackString()
            case "sort_order":   order = u.unpackInt()
            default:             u.skipValue()
            }
        }
        return AccountItem(serviceName: sn, serviceType: st, accountUrl: url, accountId: aid, sortOrder: order)
    }
}

// MARK: - CardExchangeUtil

struct CardExchangeUtil {

    /// 自分のプロフィールから送信用ペイロードを作る
    static func buildPayload(profile: Profile) -> CardPayload {
        let iconData: Data? = profile.iconPath.flatMap { path in
            guard let img = UIImage(contentsOfFile: path) else { return nil }
            return img.jpegData(compressionQuality: 0.7)
        }
        let accounts = profile.snsAccounts().map { sns in
            CardPayload.AccountItem(
                serviceName: sns.displayLabel,
                serviceType: sns.snsType.code,
                accountUrl: sns.accountUrl ?? (sns.value.hasPrefix("http") ? sns.value : nil),
                accountId: sns.accountId ?? (sns.value.hasPrefix("http") ? nil : sns.value),
                sortOrder: sns.sortOrder
            )
        }
        return CardPayload(
            deviceId: UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString,
            sentAt: Int64(Date().timeIntervalSince1970),
            name: profile.name, mail: profile.email, tel: profile.phone, address: profile.address,
            iconMime: iconData != nil ? "image/jpeg" : nil,
            iconData: iconData,
            accounts: accounts
        )
    }

    /// 受信したペイロードを Contact として保存する
    @discardableResult
    static func saveAsContact(_ payload: CardPayload) -> Contact {
        var iconPath: String? = nil
        if let data = payload.iconData, !data.isEmpty {
            iconPath = ImageUtil.saveImageData(data)
        }
        let contact = Contact(
            name: payload.name, email: payload.mail, phone: payload.tel,
            address: payload.address, iconPath: iconPath,
            receivedAt: Date(timeIntervalSince1970: TimeInterval(payload.sentAt))
        )
        contact.save()
        payload.accounts.forEach { acc in
            let value = acc.accountId ?? acc.accountUrl ?? ""
            SnsAccount.forContact(
                contactId: contact.id,
                snsType: SnsType.fromCode(acc.serviceType),
                value: value,
                sortOrder: acc.sortOrder,
                serviceName: acc.serviceName,
                accountUrl: acc.accountUrl,
                accountId: acc.accountId
            ).save()
        }
        return contact
    }
}
