import Foundation
import SwiftUI
import UIKit

@MainActor
final class GameController: ObservableObject {
    @Published var colony: Colony
    @Published var selectedID: Int?
    @Published var speed = 1
    @Published var paused = false
    @Published var trails = false
    @Published var tool: ResourceKind?
    @Published var showGuide = false
    @Published var showColony = false
    @Published var showSettings = false
    @Published var notice: String?
    @Published var saveLabel = "Autosave on"
    @Published var following = false
    let store: SaveStore
    var scene: ColonyScene!
    private var wallSinceSave = 0.0
    private var sincePublish = 0.0
    private var accumulator = 0.0
    private var engine: Colony
    private var saveBlocked = false
    let smokeTest: Bool

    init() {
        smokeTest = ProcessInfo.processInfo.arguments.contains("--smoke-test")
        let directory = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("LittleColony")
        store = SaveStore(directory:directory)
        var initial = Colony()
        var initialNotice: String?
        if !smokeTest {
            do {
                if let saved = try store.load() {
                    initial = saved.colony
                    if saved.recovered { initialNotice = "Recovered your colony from its backup." }
                }
            } catch { initialNotice = "Your save couldn't be read. This new colony won't overwrite it until you choose Save or New colony." }
        }
        engine = initial; colony = initial; notice = initialNotice
        if initialNotice?.contains("couldn't") == true { saveLabel = "Save needs attention"; saveBlocked = true }
        scene = ColonyScene(controller:self)
        if !UserDefaults.standard.bool(forKey:"hasSeenGuide") && !smokeTest { showGuide = true }
    }

    var selected: Ant? { colony.ants.first { $0.id == selectedID } }
    var activeSimulation: Colony { engine }

    func advance(wallDelta: Double) {
        let delta = max(0,min(0.1,wallDelta))
        wallSinceSave += delta; sincePublish += delta
        if !paused && !showGuide && !showSettings && !showColony {
            accumulator += delta*Double(speed)
            var steps = 0
            while accumulator >= 0.1 && steps < 8 {
                engine.step(); accumulator -= 0.1; steps += 1
            }
        }
        if sincePublish >= 0.25 {
            colony = engine; sincePublish = 0
            if let id = selectedID, !engine.ants.contains(where: { $0.id == id }) { selectedID = nil; following = false }
        }
        if wallSinceSave >= 20 && saveLabel != "Save needs attention" { save() }
    }

    func save(explicit: Bool = false) {
        guard !smokeTest, !saveBlocked || explicit else { return }
        wallSinceSave = 0
        do {
            try store.save(engine); saveLabel = "Colony saved"; wallSinceSave = 0; saveBlocked = false
        } catch { saveLabel = "Save failed"; notice = "Couldn't save your colony. Please check available storage." }
    }

    func select(_ id: Int?) {
        selectedID = id; following = false; tool = nil
    }

    func place(at x: Int) {
        guard let kind = tool else { return }
        engine.place(kind,x:x); colony = engine; tool = nil
        notice = kind == .food ? "Food placed. Let the scouts find it." : "Water placed. Workers will bring it home."
        UIImpactFeedbackGenerator(style:.soft).impactOccurred()
    }

    func newColony() {
        engine = Colony(seed:UInt64(Date().timeIntervalSince1970))
        colony = engine; selectedID = nil; following = false; paused = false
        accumulator = 0; saveBlocked = false; saveLabel = "Autosave on"; scene.resetCamera(); scene.resetWorld()
        save()
    }

    func dismissGuide() {
        showGuide = false; UserDefaults.standard.set(true,forKey:"hasSeenGuide")
    }
}
