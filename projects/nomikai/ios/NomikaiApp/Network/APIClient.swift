import Foundation

// ─────────────────────────────────────────────────────────────────────────
//  DTOs  — サーバーは全てcamelCaseでJSONを返すので CodingKeys 不要
// ─────────────────────────────────────────────────────────────────────────

struct InviteDTO: Codable {
    let id: String
    let creatorId: String
    let creatorName: String
    let dateTime: Double        // UNIXミリ秒
    let locationLat: Double?
    let locationLng: Double?
    let locationName: String?
    let participantCount: Int
    let message: String?
    let status: String
    let createdAt: Double       // UNIXミリ秒
}

struct NotificationDTO: Codable {
    let id: String
    let userId: String
    let inviteId: String?
    let title: String
    let body: String
    let data: [String: String]?
    let isRead: Int
    let createdAt: Double       // UNIXミリ秒
}

struct RestaurantDTO: Codable, Identifiable {
    let id: String
    let name: String
    let genre: String
    let budget: String
    let address: String
    let lat: Double
    let lng: Double
    let photo: String
    let catchCopy: String       // サーバーは catchCopy (camelCase)
    let shopUrl: String
    let affiliateUrl: String
    let access: String
    let open: String
    let capacity: Int
}

struct CreateInviteResponse: Codable {
    let success: Bool
    let inviteId: String        // サーバーは inviteId (camelCase)
    let notifiedCount: NotifiedCount

    struct NotifiedCount: Codable {
        let android: Int
        let web: Int
        let total: Int
    }
}

struct UserResponse: Codable {
    let id: String
    let name: String
}

// ─────────────────────────────────────────────────────────────────────────
//  APIClient
// ─────────────────────────────────────────────────────────────────────────

final class APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
            ?? "https://nomikai-server.YOUR-ACCOUNT.workers.dev"
        baseURL = URL(string: urlString)!

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)

        // サーバーはcamelCaseで返すのでデフォルト設定で一致する
        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    // ─── 汎用リクエスト ────────────────────────────────────────────────

    private func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil
    ) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try encoder.encode(body)
        }
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let msg = (try? decoder.decode([String: String].self, from: data))?["error"]
            throw APIError.serverError(msg ?? "HTTP \(http.statusCode)")
        }
        return try decoder.decode(T.self, from: data)
    }

    // ─── Users ─────────────────────────────────────────────────────────

    func registerUser(userId: String, name: String, fcmToken: String?) async throws {
        struct Body: Encodable { let userId, name: String; let fcmToken: String? }
        let _: EmptyResponse = try await request(
            "POST", path: "api/users/register",
            body: Body(userId: userId, name: name, fcmToken: fcmToken)
        )
    }

    func updateFcmToken(userId: String, fcmToken: String) async throws {
        struct Body: Encodable { let fcmToken: String }
        let _: EmptyResponse = try await request(
            "PUT", path: "api/users/\(userId)/fcm-token",
            body: Body(fcmToken: fcmToken)
        )
    }

    func addFriend(userId: String, friendId: String) async throws {
        struct Body: Encodable { let friendId: String }
        let _: EmptyResponse = try await request(
            "POST", path: "api/users/\(userId)/friends",
            body: Body(friendId: friendId)
        )
    }

    func getFriends(userId: String) async throws -> [UserResponse] {
        try await request("GET", path: "api/users/\(userId)/friends")
    }

    func getUser(userId: String) async throws -> UserResponse {
        try await request("GET", path: "api/users/\(userId)")
    }

    // ─── Invites ───────────────────────────────────────────────────────

    struct CreateInviteBody: Encodable {
        let creatorId: String
        let dateTime: Double
        let locationLat: Double?
        let locationLng: Double?
        let locationName: String?
        let participantCount: Int
        let message: String?
    }

    func createInvite(_ body: CreateInviteBody) async throws -> CreateInviteResponse {
        try await request("POST", path: "api/invites", body: body)
    }

    func getReceivedInvites(userId: String) async throws -> [InviteDTO] {
        try await request("GET", path: "api/invites/received/\(userId)")
    }

    func getSentInvites(userId: String) async throws -> [InviteDTO] {
        try await request("GET", path: "api/invites/sent/\(userId)")
    }

    // ─── Restaurants ───────────────────────────────────────────────────

    func getNearbyRestaurants(
        lat: Double, lng: Double, range: Int = 3, count: Int = 8
    ) async throws -> [RestaurantDTO] {
        var comps = URLComponents(
            url: baseURL.appendingPathComponent("api/restaurants/nearby"),
            resolvingAgainstBaseURL: false
        )!
        comps.queryItems = [
            .init(name: "lat",   value: String(lat)),
            .init(name: "lng",   value: String(lng)),
            .init(name: "range", value: String(range)),
            .init(name: "count", value: String(count)),
        ]
        let req = URLRequest(url: comps.url!)
        let (data, _) = try await session.data(for: req)
        struct Wrapper: Decodable { let results: [RestaurantDTO] }
        return try decoder.decode(Wrapper.self, from: data).results
    }

    // ─── Notifications ─────────────────────────────────────────────────

    func getNotifications(userId: String) async throws -> [NotificationDTO] {
        try await request("GET", path: "api/notifications/\(userId)")
    }

    func markAsRead(notificationId: String, userId: String) async throws {
        struct Body: Encodable { let userId: String }
        let _: EmptyResponse = try await request(
            "PUT", path: "api/notifications/\(notificationId)/read",
            body: Body(userId: userId)
        )
    }

    func markAllAsRead(userId: String) async throws {
        let _: EmptyResponse = try await request(
            "PUT", path: "api/notifications/\(userId)/read-all"
        )
    }
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────

struct EmptyResponse: Decodable {}

enum APIError: LocalizedError {
    case serverError(String)
    var errorDescription: String? {
        if case .serverError(let msg) = self { return msg }
        return nil
    }
}
