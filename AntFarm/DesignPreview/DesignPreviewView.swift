import SwiftUI
import SpriteKit

private enum Theme {
    static let ink = Color(red: 0.09, green: 0.08, blue: 0.12)
    static let panel = Color(red: 0.14, green: 0.13, blue: 0.17)
    static let cream = Color(red: 0.96, green: 0.91, blue: 0.81)
    static let muted = Color(red: 0.72, green: 0.69, blue: 0.66)
    static let amber = Color(red: 0.91, green: 0.72, blue: 0.42)
    static let sage = Color(red: 0.58, green: 0.69, blue: 0.55)
    static let water = Color(red: 0.52, green: 0.74, blue: 0.79)
}

struct DesignPreviewView: View {
    @StateObject private var model = DesignPreviewModel()

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Theme.ink.ignoresSafeArea()
                if let scene = model.scene {
                    SpriteView(scene: scene, preferredFramesPerSecond: 30,
                               options: [.ignoresSiblingOrder])
                        .ignoresSafeArea()
                        .accessibilityLabel("Static pixel-art ant nest. Use Inspect to select an ant.")
                } else {
                    ContentUnavailableView("Preview unavailable", systemImage: "ant",
                        description: Text("The reference artwork or world fixture could not be loaded."))
                }
                VStack(spacing: 10) {
                    header(compact: geometry.size.width < 750)
                    Spacer(minLength: 0)
                    HStack {
                        dock
                        Spacer(minLength: 0)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                if let ant = model.selectedAnt {
                    inspector(ant, short: geometry.size.height < 360)
                        .frame(width: geometry.size.width < 750 ? 224 : 246,
                               height: max(180, geometry.size.height - 90))
                        .padding(.top, 78)
                        .padding(.trailing, 12)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                }
            }
            .foregroundStyle(Theme.cream)
            .fontDesign(.rounded)
            .sheet(isPresented: $model.showAntList) { antList }
            .sheet(isPresented: $model.showInformation) { information }
        }
    }

    private func header(compact: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 9) {
                    Text("ANT FARM").font(.system(size: 20, weight: .black, design: .rounded)).tracking(2)
                    Text("DESIGN PREVIEW")
                        .font(.system(size: 8, weight: .bold))
                        .padding(.horizontal, 7).padding(.vertical, 5)
                        .background(Theme.sage.opacity(0.18), in: Capsule())
                        .foregroundStyle(Theme.sage)
                }
                Text("Pheidole pallidula · a world beneath your feet")
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(Theme.ink.opacity(0.96), in: RoundedRectangle(cornerRadius: 12))
            Spacer(minLength: 0)
            if !compact, let world = model.world {
                VStack(alignment: .leading, spacing: 4) {
                    Text("REFERENCE COLONY").font(.system(size: 8, weight: .bold)).tracking(1.2)
                        .foregroundStyle(Theme.muted)
                    Text("\(world.samplePopulation) ants  ·  \(world.sampleBrood) brood")
                        .font(.system(size: 13, weight: .semibold))
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Theme.ink.opacity(0.96), in: RoundedRectangle(cornerRadius: 12))
            }
            control("About this preview", icon: "info", identifier: "previewInfo") {
                model.showInformation = true
            }
        }
    }

    private func inspector(_ ant: ReferenceAnt, short: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("INDIVIDUAL").font(.system(size: 8, weight: .bold)).tracking(1.8)
                            .foregroundStyle(Theme.amber)
                        Text(ant.id).font(.system(size: 23, weight: .bold, design: .monospaced))
                            .accessibilityIdentifier("selectedAntID")
                        Text("SAMPLE · NOT SIMULATED")
                            .font(.system(size: 7, weight: .bold)).foregroundStyle(Theme.muted)
                            .accessibilityIdentifier("sampleDataNotice")
                    }
                    Spacer()
                    Button(action: model.closeInspector) {
                        Image(systemName: "xmark").font(.system(size: 12, weight: .bold))
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Close inspector")
                }
            ScrollView {
                VStack(alignment: .leading, spacing: short ? 8 : 11) {
                HStack {
                    Text(ant.caste).font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Theme.amber.opacity(0.14), in: Capsule())
                    Spacer()
                    Text("\(ant.ageDays) days").font(.system(size: 11)).foregroundStyle(Theme.muted)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(ant.action).font(.system(size: 14, weight: .semibold))
                    Text(ant.reason).font(.system(size: 11)).foregroundStyle(Theme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                stat("Health", value: ant.health, color: Theme.sage)
                stat("Energy", value: ant.energy, color: Theme.amber)
                stat("Hydration", value: ant.hydration, color: Theme.water)
                HStack {
                    Text("Carrying").foregroundStyle(Theme.muted)
                    Spacer()
                    Text(ant.carriedItem).lineLimit(2).multilineTextAlignment(.trailing)
                }.font(.system(size: 11))
                }
            }.scrollIndicators(.hidden)
            Button {
                    model.scene?.focus(ant)
                } label: {
                    Label("Focus ant", systemImage: "scope")
                        .font(.system(size: 12, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Theme.amber, in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(Theme.ink)
                }.accessibilityIdentifier("focusAnt")
        }.padding(14)
        .background(Theme.panel.opacity(0.98), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.amber.opacity(0.4), lineWidth: 1))
        .accessibilityIdentifier("antInspector")
    }

    private func stat(_ title: String, value: Int, color: Color) -> some View {
        HStack(spacing: 8) {
            Text(title).font(.system(size: 10)).foregroundStyle(Theme.muted).frame(width: 53, alignment: .leading)
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.cream.opacity(0.1))
                    Capsule().fill(color).frame(width: geometry.size.width * Double(value) / 100)
                }
            }.frame(height: 4)
            Text("\(value)%").font(.system(size: 10, weight: .semibold, design: .monospaced)).frame(width: 32)
        }.accessibilityElement(children: .ignore).accessibilityLabel("\(title), \(value) percent")
    }

    private var dock: some View {
        HStack(spacing: 3) {
            dockControl("Inspect", icon: "ant", identifier: "inspectAnts") { model.showAntList = true }
            dockControl("Trails", icon: "point.topleft.down.to.point.bottomright.curvepath",
                        active: model.showTrails, identifier: "toggleTrails") { model.showTrails.toggle() }
            dockControl("Nest", icon: "house", identifier: "recenterNest") { model.scene?.recenter() }
            Rectangle().fill(Theme.cream.opacity(0.15)).frame(width: 1, height: 24).padding(.horizontal, 4)
            control("Zoom out", icon: "minus", identifier: "zoomOut") { model.scene?.zoom(by: 1.25) }
            control("Zoom in", icon: "plus", identifier: "zoomIn") { model.scene?.zoom(by: 0.8) }
        }
        .padding(5)
        .background(Theme.ink.opacity(0.97), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.cream.opacity(0.12)))
    }

    private func dockControl(_ title: String, icon: String, active: Bool = false,
                             identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 16))
                Text(title).font(.system(size: 9, weight: .semibold))
            }
            .frame(width: 52, height: 46)
            .foregroundStyle(active ? Theme.amber : Theme.cream)
            .background(active ? Theme.amber.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 8))
        }
        .accessibilityLabel(title)
        .accessibilityValue(active ? "On" : "Off")
        .accessibilityIdentifier(identifier)
    }

    private func control(_ title: String, icon: String, identifier: String,
                         action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                .frame(width: 44, height: 44)
                .background(Theme.ink.opacity(0.96), in: RoundedRectangle(cornerRadius: 10))
        }.accessibilityLabel(title).accessibilityIdentifier(identifier)
    }

    private var antList: some View {
        NavigationStack {
            List(model.world?.ants ?? []) { ant in
                Button { model.select(ant) } label: {
                    HStack {
                        Image(systemName: "ant").foregroundStyle(Theme.amber)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(ant.id).font(.headline)
                            Text("\(ant.caste) · \(ant.job)").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if model.selectedAnt?.id == ant.id { Image(systemName: "checkmark") }
                    }.frame(minHeight: 44)
                }.accessibilityIdentifier("antRow_\(ant.id)")
            }
            .navigationTitle("Reference ants")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { model.showAntList = false } } }
        }
    }

    private var information: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("A world beneath your feet.").font(.title2.bold())
                    Text("Steps 1–2: native foundation and visual direction. This is a static design scene, with illustrative ants and stats. No colony simulation is running.")
                    Text("Drag to pan. Pinch or use +/− to zoom. Tap an illustrated ant or use Inspect to choose one. Focus ant centers your selection. Trails shows a sample pheromone route; Nest resets the camera.")
                    Text("The next milestone adds a small living colony: workers that gather food, excavate soil, carry material, and help a queen survive.")
                    Text("Art direction is original AI-generated concept artwork. It is not yet an animated game asset set or an anatomically exact species illustration.")
                        .font(.footnote).foregroundStyle(.secondary)
                }.padding(24)
            }
            .navigationTitle("Design preview")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { model.showInformation = false } } }
        }
    }
}
