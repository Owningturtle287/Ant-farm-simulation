import SwiftUI

@MainActor
final class DesignPreviewModel: ObservableObject {
    let world: ReferenceWorld?
    let scene: ReferenceColonyScene?
    @Published var selectedAnt: ReferenceAnt?
    @Published var showTrails = false {
        didSet { scene?.setTrailsVisible(showTrails) }
    }
    @Published var showAntList = false
    @Published var showInformation = false

    init() {
        do {
            let loaded = try ReferenceWorld.load()
            world = loaded
            let newScene = ReferenceColonyScene(world: loaded)
            scene = newScene
            selectedAnt = loaded.ants.first(where: { $0.id == "C-027" }) ?? loaded.ants.first
            if let ant = selectedAnt { newScene.select(ant) }
            newScene.onSelect = { [weak self] ant in self?.selectedAnt = ant }
        } catch {
            world = nil
            scene = nil
        }
    }

    func select(_ ant: ReferenceAnt) {
        selectedAnt = ant
        scene?.select(ant)
        showAntList = false
    }

    func closeInspector() {
        selectedAnt = nil
        scene?.clearSelection()
    }
}
