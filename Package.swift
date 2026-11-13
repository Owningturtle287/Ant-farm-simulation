// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AntFarmCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [.library(name: "AntFarmCore", targets: ["AntFarmCore"])],
    targets: [
        .target(name: "AntFarmCore"),
        .testTarget(name: "AntFarmCoreTests", dependencies: ["AntFarmCore"])
    ]
)
