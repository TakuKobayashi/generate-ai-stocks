import Foundation

/// SNS種別。code は MessagePack の service_type enum 値と対応する。
enum SnsType: String, CaseIterable, Identifiable {
    case twitter, facebook, line, whatsapp, instagram
    case tiktok, youtube, github, linkedin, website, other

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .twitter:   return "X (Twitter)"
        case .facebook:  return "Facebook"
        case .line:      return "LINE"
        case .whatsapp:  return "WhatsApp"
        case .instagram: return "Instagram"
        case .tiktok:    return "TikTok"
        case .youtube:   return "YouTube"
        case .github:    return "GitHub"
        case .linkedin:  return "LinkedIn"
        case .website:   return "Webサイト・その他URL"
        case .other:     return "その他"
        }
    }

    /// SF Symbols アイコン名
    var symbolName: String {
        switch self {
        case .twitter:   return "at"
        case .facebook:  return "globe"
        case .line:      return "bubble.left"
        case .whatsapp:  return "bubble.left.fill"
        case .instagram: return "camera"
        case .tiktok:    return "music.note"
        case .youtube:   return "play.rectangle"
        case .github:    return "chevron.left.forwardslash.chevron.right"
        case .linkedin:  return "briefcase"
        case .website:   return "link"
        case .other:     return "ellipsis.circle"
        }
    }

    var code: Int {
        switch self {
        case .other:     return 0
        case .twitter:   return 1
        case .facebook:  return 2
        case .line:      return 3
        case .whatsapp:  return 4
        case .instagram: return 5
        case .tiktok:    return 6
        case .youtube:   return 7
        case .github:    return 8
        case .linkedin:  return 9
        case .website:   return 10
        }
    }

    static func fromCode(_ code: Int) -> SnsType {
        allCases.first { $0.code == code } ?? .other
    }

    static let primary: [SnsType] = [.twitter, .facebook, .line, .whatsapp, .instagram]
    static let others:  [SnsType] = [.tiktok, .youtube, .github, .linkedin, .website, .other]
}
