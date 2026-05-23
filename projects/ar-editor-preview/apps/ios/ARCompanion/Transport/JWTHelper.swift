// apps/ios/ARCompanion/Transport/JWTHelper.swift
// 開発用 LiveKit JWT トークンを Swift で生成する。
// 本番環境ではサーバーサイドで生成すること。

import Foundation
import CryptoKit

enum JWTHelper {

    /// LiveKit 開発用 JWT (HS256) を生成する。
    static func generateDevToken(
        serverUrl  : String,
        room       : String,
        identity   : String,
        apiKey     : String,
        apiSecret  : String
    ) -> String {
        let now = Int(Date().timeIntervalSince1970)

        // ─── Header ──────────────────────────────────────────
        let headerJSON  = #"{"alg":"HS256","typ":"JWT"}"#
        let header      = base64url(Data(headerJSON.utf8))

        // ─── Payload ─────────────────────────────────────────
        let payloadDict: [String: Any] = [
            "iss"  : apiKey,
            "sub"  : identity,
            "iat"  : now,
            "exp"  : now + 3600,
            "nbf"  : now,
            "jti"  : UUID().uuidString.replacingOccurrences(of: "-", with: ""),
            "video": [
                "room"          : room,
                "roomJoin"      : true,
                "canPublish"    : true,
                "canSubscribe"  : false,
                "canPublishData": false,
            ] as [String: Any]
        ]

        guard
            let payloadData = try? JSONSerialization.data(
                withJSONObject: payloadDict,
                options: [.sortedKeys]
            )
        else {
            assertionFailure("JWT payload serialization failed")
            return ""
        }
        let payload = base64url(payloadData)

        // ─── Signature (HMAC-SHA256) ─────────────────────────
        let sigInput = "\(header).\(payload)"
        let keyData  = Data(apiSecret.utf8)
        let key      = SymmetricKey(data: keyData)
        let mac      = HMAC<SHA256>.authenticationCode(
            for: Data(sigInput.utf8),
            using: key
        )
        let sig = base64url(Data(mac))

        return "\(header).\(payload).\(sig)"
    }

    // MARK: - Private

    private static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .trimmingCharacters(in: ["="])
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
    }
}
