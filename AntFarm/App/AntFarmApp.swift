import SwiftUI

@main
struct AntFarmApp: App {
    var body: some Scene {
        WindowGroup {
            DesignPreviewView()
                .preferredColorScheme(.dark)
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
        }
    }
}
