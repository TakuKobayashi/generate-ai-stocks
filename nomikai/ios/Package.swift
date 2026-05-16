// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NomikaiApp",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "NomikaiApp", targets: ["NomikaiApp"]),
    ],
    dependencies: [
        // SQLite ORM - ActiveRecordパターンの基盤
        .package(
            url: "https://github.com/groue/GRDB.swift.git",
            from: "6.29.0"
        ),
    ],
    targets: [
        .target(
            name: "NomikaiApp",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
    ]
)

// ─── CocoaPods (Podfile) でインストールするライブラリ ──────────────────────
// Firebase SDK と Google Maps は CocoaPods 経由で導入する。
// 下記の Podfile を参照。
//
//   pod 'Firebase/Core'
//   pod 'Firebase/Messaging'
//   pod 'GoogleMaps'
