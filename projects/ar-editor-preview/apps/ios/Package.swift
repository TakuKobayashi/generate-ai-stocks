// apps/ios/ARCompanion/Package.swift
// Swift Package Manager 依存関係定義

// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ARCompanion",
    platforms: [.iOS(.v16)],
    dependencies: [
        // LiveKit Swift SDK
        .package(
            url: "https://github.com/livekit/client-sdk-swift.git",
            from: "2.0.0"
        ),
        // Swift Protobuf (apple/swift-protobuf)
        .package(
            url: "https://github.com/apple/swift-protobuf.git",
            from: "1.26.0"
        ),
    ],
    targets: [
        .target(
            name: "ARCompanion",
            dependencies: [
                .product(name: "LiveKit",        package: "client-sdk-swift"),
                .product(name: "SwiftProtobuf",  package: "swift-protobuf"),
            ],
            path: "ARCompanion",
            // gen/ から コピーした Swift Proto ファイルも含む
            sources: [".", "Proto"]
        ),
        .testTarget(
            name: "ARCompanionTests",
            dependencies: ["ARCompanion"],
            path: "ARCompanionTests"
        ),
    ]
)
