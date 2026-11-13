import SwiftUI
import SpriteKit

private enum Theme {
    static let panel = Color(red:0.065,green:0.115,blue:0.10)
    static let cream = Color(red:0.93,green:0.91,blue:0.83)
    static let muted = Color(red:0.60,green:0.68,blue:0.59)
    static let green = Color(red:0.65,green:0.79,blue:0.52)
    static let amber = Color(red:0.92,green:0.76,blue:0.50)
    static let blue = Color(red:0.56,green:0.77,blue:0.81)
}

struct GameView: View {
    @ObservedObject var game: GameController
    @State private var confirmReset = false
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                SpriteView(scene:game.scene,preferredFramesPerSecond:60)
                    .ignoresSafeArea()
                    .accessibilityLabel("Ant colony. Drag to explore, pinch to zoom, tap an ant to inspect.")
                    .accessibilityIdentifier("colonyWorld")
                VStack(spacing:0) {
                    header
                    Spacer(minLength:0)
                    if let kind = game.tool { placementHint(kind) }
                    if let notice = game.notice {
                        Text(notice).font(.system(size:12,weight:.medium))
                            .foregroundStyle(Theme.cream).padding(.horizontal,16).padding(.vertical,10)
                            .background(Theme.panel.opacity(0.95),in:Capsule()).padding(.bottom,8)
                            .accessibilityIdentifier("notice")
                    }
                    HStack(alignment:.bottom,spacing:14) {
                        if geometry.size.width > 780 && game.selectedID == nil { journal }
                        Spacer(minLength:0)
                        toolbar
                        Spacer(minLength:0)
                    }.padding(.bottom,12)
                }
                .padding(.horizontal,14)
                if let ant = game.selected {
                    HStack { Spacer(); inspector(ant) }
                        .padding(.top,76).padding(.bottom,84).padding(.trailing,16)
                }
                if game.paused {
                    VStack { Spacer(); Label("PAUSED",systemImage:"pause.fill").font(.system(size:10,weight:.bold,design:.monospaced)).tracking(2)
                        .foregroundStyle(Theme.amber).padding(.horizontal,14).padding(.vertical,7)
                        .background(Theme.panel,in:Capsule()); Spacer() }
                        .allowsHitTesting(false)
                }
            }
            .background(Theme.panel)
        }
        .sheet(isPresented:$game.showGuide) { guide }
        .sheet(isPresented:$game.showColony) { colonySheet }
        .sheet(isPresented:$game.showSettings) { settingsSheet }
        .task(id:game.notice) {
            guard game.notice != nil else { return }
            try? await Task.sleep(nanoseconds:5_000_000_000)
            if !Task.isCancelled { game.notice = nil }
        }
        .statusBarHidden()
    }

    private var header: some View {
        HStack(spacing:12) {
            VStack(alignment:.leading,spacing:2) {
                HStack(spacing:6) {
                    Circle().fill(Theme.green).frame(width:5,height:5)
                    Text("LITTLE COLONY").font(.system(size:9,weight:.bold,design:.monospaced)).tracking(2.5)
                }.foregroundStyle(Theme.green)
                Text("The first clearing").font(.system(size:19,weight:.semibold,design:.serif)).foregroundStyle(Theme.cream)
            }.frame(minWidth:148,alignment:.leading)
            Spacer(minLength:0)
            stat("ant.fill",value:"\(game.colony.ants.count)",label:"ANTS",color:Theme.cream)
            stat("leaf.fill",value:"\(Int(game.colony.food))",label:"FOOD",color:Theme.green)
            stat("drop.fill",value:"\(Int(game.colony.water))",label:"WATER",color:Theme.blue)
            stat("circle.grid.2x2.fill",value:"\(game.colony.brood.count)",label:"BROOD",color:Theme.amber)
            Divider().overlay(Theme.muted.opacity(0.25)).frame(height:27)
            Button { game.speed = game.speed == 1 ? 2 : game.speed == 2 ? 4 : 1 } label: {
                Text("\(game.speed)×").font(.system(size:14,weight:.semibold,design:.monospaced)).frame(width:36,height:40)
            }.accessibilityLabel("Simulation speed").accessibilityValue("\(game.speed) times").accessibilityIdentifier("speedButton")
            Button { game.paused.toggle() } label: {
                Image(systemName:game.paused ? "play.fill" : "pause.fill").font(.system(size:14)).frame(width:36,height:40)
            }.accessibilityLabel(game.paused ? "Resume simulation" : "Pause simulation").accessibilityIdentifier("pauseButton")
        }
        .foregroundStyle(Theme.cream).padding(.horizontal,16).padding(.vertical,11)
        .background(Theme.panel.opacity(0.96),in:RoundedRectangle(cornerRadius:16))
        .overlay(RoundedRectangle(cornerRadius:16).strokeBorder(Theme.muted.opacity(0.20),lineWidth:1))
        .padding(.top,8)
    }

    private func stat(_ icon: String,value: String,label: String,color: Color) -> some View {
        VStack(alignment:.leading,spacing:2) {
            HStack(spacing:5) { Image(systemName:icon).font(.system(size:11)); Text(value).font(.system(size:16,weight:.medium,design:.monospaced)).monospacedDigit() }
            Text(label).font(.system(size:8,weight:.bold,design:.monospaced)).tracking(1.4).foregroundStyle(Theme.muted)
        }.foregroundStyle(color).frame(minWidth:43,alignment:.leading)
    }

    private var toolbar: some View {
        HStack(spacing:2) {
            toolButton("Food",icon:"leaf",active:game.tool == .food) { game.tool = game.tool == .food ? nil : .food; game.selectedID = nil }
            toolButton("Water",icon:"drop",active:game.tool == .water) { game.tool = game.tool == .water ? nil : .water; game.selectedID = nil }
            Divider().overlay(Theme.muted.opacity(0.2)).frame(height:25).padding(.horizontal,3)
            toolButton("Trails",icon:"point.topleft.down.curvedto.point.bottomright.up",active:game.trails) { game.trails.toggle() }
            toolButton("Nest",icon:"viewfinder",active:false) { game.scene.resetCamera(); game.selectedID = nil; game.tool = nil }
            toolButton("Colony",icon:"ant",active:false) { game.showColony = true; game.tool = nil }
            toolButton("More",icon:"ellipsis",active:false) { game.showSettings = true; game.tool = nil }
        }
        .padding(.horizontal,9).padding(.vertical,7)
        .background(Theme.panel.opacity(0.97),in:RoundedRectangle(cornerRadius:18))
        .overlay(RoundedRectangle(cornerRadius:18).strokeBorder(Theme.muted.opacity(0.24),lineWidth:1))
        .shadow(color:.black.opacity(0.2),radius:12,y:5)
    }

    private func toolButton(_ title: String,icon: String,active: Bool,action: @escaping () -> Void) -> some View {
        Button(action:action) {
            VStack(spacing:5) {
                Image(systemName:icon).font(.system(size:17,weight:.regular)).frame(height:18)
                Text(title).font(.system(size:9,weight:.medium))
            }.foregroundStyle(active ? Theme.panel : Theme.cream)
                .frame(width:45,height:44)
                .background(active ? Theme.green : Color.clear,in:RoundedRectangle(cornerRadius:11))
        }.buttonStyle(.plain).accessibilityLabel(title).accessibilityIdentifier("tool\(title)")
    }

    private var journal: some View {
        VStack(alignment:.leading,spacing:5) {
            Text("DAY \(game.colony.day)  /  \(game.saveLabel.uppercased())")
                .font(.system(size:8,weight:.semibold,design:.monospaced)).tracking(1.1).foregroundStyle(Theme.green)
            Text(game.colony.events.first?.text ?? "Life, one small step at a time.")
                .font(.system(size:12,design:.serif)).foregroundStyle(Theme.cream).lineLimit(2)
        }.frame(width:220,alignment:.leading).padding(12)
            .background(Theme.panel.opacity(0.88),in:RoundedRectangle(cornerRadius:12))
    }

    private func placementHint(_ kind: ResourceKind) -> some View {
        HStack(spacing:10) {
            Image(systemName:kind == .food ? "leaf.fill" : "drop.fill")
            Text("Tap anywhere to place \(kind.rawValue) on the surface")
            Button("Cancel") { game.tool = nil }.foregroundStyle(Theme.amber)
        }.font(.system(size:12,weight:.medium)).foregroundStyle(Theme.cream)
            .padding(12).background(Theme.panel,in:Capsule()).padding(.bottom,8)
    }

    private func inspector(_ ant: Ant) -> some View {
        ScrollView {
            VStack(alignment:.leading,spacing:12) {
                HStack {
                    Text("ANT PROFILE").font(.system(size:8,weight:.bold,design:.monospaced)).tracking(2).foregroundStyle(Theme.green)
                    Spacer()
                    Button { game.select(nil) } label: { Image(systemName:"xmark").font(.system(size:12)).frame(width:28,height:28) }.accessibilityLabel("Close ant profile")
                }
                HStack(alignment:.top) {
                    Image(systemName:"ant.fill").font(.system(size:28)).foregroundStyle(Theme.amber).frame(width:40,height:42)
                    VStack(alignment:.leading,spacing:4) {
                        Text(ant.name).font(.system(size:19,weight:.semibold,design:.serif)).accessibilityIdentifier("selectedAntName")
                        Text(ant.caste.rawValue.uppercased()).font(.system(size:9,weight:.medium,design:.monospaced)).tracking(2).foregroundStyle(Theme.muted)
                    }
                }
                Text(ant.task.rawValue).font(.system(size:12,weight:.semibold)).foregroundStyle(Theme.amber)
                meter("Energy",value:ant.energy,color:Theme.green)
                meter("Health",value:ant.health,color:Theme.blue)
                HStack {
                    smallStat("AGE","\(Int(ant.age/60))m")
                    Spacer(); smallStat("EXPERIENCE","\(ant.experience)")
                    Spacer(); smallStat("TRIPS","\(ant.trips)")
                }
                Text(ant.reason).font(.system(size:11)).lineSpacing(3).foregroundStyle(Theme.muted)
                Button {
                    game.following.toggle()
                    if game.following { game.scene.focus(on:ant) }
                } label: {
                    Label(game.following ? "Following ant" : "Follow this ant",systemImage:"scope")
                        .font(.system(size:11,weight:.semibold)).frame(maxWidth:.infinity).padding(.vertical,10)
                        .background(Theme.green.opacity(0.14),in:RoundedRectangle(cornerRadius:8))
                }.accessibilityIdentifier("followAnt")
            }.padding(15)
        }
        .frame(width:228).foregroundStyle(Theme.cream)
        .background(Theme.panel.opacity(0.97),in:RoundedRectangle(cornerRadius:16))
        .overlay(RoundedRectangle(cornerRadius:16).strokeBorder(Theme.muted.opacity(0.25),lineWidth:1))
    }

    private func meter(_ title: String,value: Double,color: Color) -> some View {
        VStack(spacing:5) {
            HStack { Text(title); Spacer(); Text("\(Int(value*100))%") }.font(.system(size:10)).foregroundStyle(Theme.muted)
            GeometryReader { geometry in
                ZStack(alignment:.leading) {
                    Capsule().fill(Theme.muted.opacity(0.15))
                    Capsule().fill(color).frame(width:geometry.size.width*value)
                }
            }.frame(height:4)
        }
    }
    private func smallStat(_ label: String,_ value: String) -> some View {
        VStack(alignment:.leading,spacing:4) {
            Text(label).font(.system(size:7,weight:.semibold,design:.monospaced)).foregroundStyle(Theme.muted)
            Text(value).font(.system(size:13,weight:.medium,design:.monospaced))
        }
    }

    private var guide: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:18) {
                    Text("A whole world,\none small colony.").font(.system(size:32,weight:.medium,design:.serif)).foregroundStyle(Theme.cream)
                    Text("Your ants have lives of their own. Give them a little care, then watch their world take shape.").font(.system(size:15)).foregroundStyle(Theme.muted)
                    guideRow("hand.draw","Explore the clearing","Drag to look around. Pinch to get closer. Tap an ant to meet it.")
                    guideRow("leaf","Leave a little food and water","Choose Food or Water, then tap the world. Scouts will discover it and carry it home.")
                    guideRow("ant","Let the colony build","Workers dig, raise brood, and carry earth to the surface. Turn on Trails to see their scent signals.")
                    guideRow("moon","Return whenever you like","Your colony saves automatically and rests while the app is closed.")
                    Button { game.dismissGuide() } label: {
                        Text("Enter the clearing").font(.system(size:15,weight:.semibold)).foregroundStyle(Theme.panel)
                            .frame(maxWidth:.infinity).padding(16).background(Theme.green,in:RoundedRectangle(cornerRadius:12))
                    }.accessibilityIdentifier("enterColony")
                }.padding(28).frame(maxWidth:600)
            }.frame(maxWidth:.infinity).background(Theme.panel)
                .toolbar { ToolbarItem(placement:.topBarTrailing) { Button("Done") { game.dismissGuide() }.foregroundStyle(Theme.green) } }
        }.interactiveDismissDisabled(!UserDefaults.standard.bool(forKey:"hasSeenGuide"))
    }

    private func guideRow(_ icon: String,_ title: String,_ body: String) -> some View {
        HStack(alignment:.top,spacing:14) {
            Image(systemName:icon).font(.system(size:21)).foregroundStyle(Theme.amber).frame(width:28)
            VStack(alignment:.leading,spacing:5) {
                Text(title).font(.system(size:14,weight:.semibold)).foregroundStyle(Theme.cream)
                Text(body).font(.system(size:12)).foregroundStyle(Theme.muted).lineSpacing(3)
            }
        }
    }

    private var colonySheet: some View {
        NavigationStack {
            List {
                Section {
                    HStack { sheetMetric("Workers",game.colony.workers); Spacer(); sheetMetric("Brood",game.colony.brood.count); Spacer(); sheetMetric("New ants",game.colony.births) }
                    Text("\(game.colony.world.soilExcavated) soil excavated · \(game.colony.world.soilDeposited) deposited in the mound")
                        .font(.system(size:12)).foregroundStyle(Theme.muted)
                } header: { Text("Day \(game.colony.day) · \(Int(game.colony.time/60)) minutes in the clearing") }
                Section("Meet your ants") {
                    ForEach(game.colony.ants) { ant in
                        Button {
                            game.select(ant.id); game.scene.focus(on:ant); game.showColony = false
                        } label: {
                            HStack(spacing:14) {
                                Image(systemName:"ant.fill").foregroundStyle(ant.caste == .queen ? Theme.amber : Theme.green)
                                VStack(alignment:.leading,spacing:3) {
                                    Text(ant.name).foregroundStyle(Theme.cream)
                                    Text(ant.task.rawValue).font(.system(size:11)).foregroundStyle(Theme.muted)
                                }
                                Spacer(); Text(ant.caste.rawValue).font(.system(size:11)).foregroundStyle(Theme.muted)
                            }.padding(.vertical,3)
                        }.accessibilityIdentifier("antRow\(ant.id)")
                    }
                }
            }.scrollContentBackground(.hidden).background(Theme.panel)
                .navigationTitle("Your colony").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement:.topBarTrailing) { Button("Done") { game.showColony = false } } }
        }.tint(Theme.green)
    }

    private func sheetMetric(_ title: String,_ value: Int) -> some View {
        VStack(alignment:.leading,spacing:4) {
            Text("\(value)").font(.system(size:26,weight:.medium,design:.serif)).foregroundStyle(Theme.cream)
            Text(title).font(.system(size:11)).foregroundStyle(Theme.muted)
        }
    }

    private var settingsSheet: some View {
        NavigationStack {
            List {
                Section("Your clearing") {
                    Button { game.save(explicit:true); game.notice = game.saveLabel; game.showSettings = false } label: { Label("Save colony now",systemImage:"square.and.arrow.down") }
                    Button { game.showSettings = false; DispatchQueue.main.asyncAfter(deadline:.now()+0.4) { game.showGuide = true } } label: { Label("How to play",systemImage:"questionmark.circle") }
                    Button(role:.destructive) { confirmReset = true } label: { Label("Start a new colony",systemImage:"arrow.counterclockwise") }
                }
                Section("First clearing · v0.1") {
                    Text("A living colony with food, water, brood, individual ants, excavation, and a growing mound. This first version has a 120-ant limit.")
                    Text("The simulation pauses while menus are open and while the app is closed. Soldiers patrol; predators, combat, complex learning, and advanced weather are planned for later.")
                    Text("Original procedural pixel art. No network connection needed to play.")
                }.font(.system(size:12)).foregroundStyle(Theme.muted)
            }.scrollContentBackground(.hidden).background(Theme.panel)
                .navigationTitle("A little care").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement:.topBarTrailing) { Button("Done") { game.showSettings = false } } }
        }.tint(Theme.green)
        .confirmationDialog("Start a new colony? Your current colony will be replaced.",isPresented:$confirmReset,titleVisibility:.visible) {
            Button("Start new colony",role:.destructive) { game.newColony(); game.showSettings = false }
        }
    }
}
