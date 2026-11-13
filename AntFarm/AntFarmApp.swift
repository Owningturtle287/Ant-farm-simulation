import SwiftUI

@main
struct AntFarmApp: App {
    @StateObject private var game = GameController()
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            GameView(game:game)
                .preferredColorScheme(.dark)
                .onChange(of:scenePhase) { _, phase in
                    if phase != .active { game.save() }
                }
        }
    }
}
