import Foundation

public enum Caste: String, Codable { case queen = "Queen", worker = "Worker", soldier = "Soldier" }
public enum AntTask: String, Codable {
    case queen = "Laying eggs", exploring = "Exploring", toFood = "Following a food trail"
    case toWater = "Collecting water", returningFood = "Bringing food home", returningWater = "Bringing water home"
    case toDig = "Heading to the dig", digging = "Excavating", haulingSoil = "Carrying soil"
    case nursing = "Tending brood", resting = "Resting", patrolling = "Guarding the entrance"
}
public struct Ant: Codable, Identifiable {
    public var id: Int
    public var caste: Caste
    public var task: AntTask
    public var cell: Cell
    public var position: Position
    public var route: [Cell] = []
    public var target: Cell?
    public var memory: Cell?
    public var energy = 1.0
    public var health = 1.0
    public var age = 0.0
    public var experience = 0
    public var carried = 0.0
    public var busyUntil = 0.0
    public var trips = 0
    public var bornAt = 0.0
    public var name: String {
        if caste == .queen { return "Queen Aurelia" }
        let names = ["Amber", "Clover", "Fern", "Hazel", "Moss", "Pip", "Rowan", "Sage"]
        return "\(names[id % names.count]) \(String(format: "%02d", id))"
    }
    public var reason: String {
        switch task {
        case .queen: return "A fed, hydrated colony can support new eggs."
        case .exploring: return "Searching the surface for resources within sensing range."
        case .toFood: return "A scent signal or a remembered food source looks promising."
        case .toWater: return "The colony needs water to support its brood."
        case .returningFood, .returningWater: return "Carrying a resource back to the shared stores."
        case .toDig, .digging: return "More nest space is needed for the growing colony."
        case .haulingSoil: return "Moving excavated earth to the mound above ground."
        case .nursing: return "Keeping close to the queen and developing brood."
        case .resting: return "Recovering energy near the colony's shared stores."
        case .patrolling: return "Checking the entrance and nearby ground."
        }
    }
    public init(id: Int, caste: Caste, cell: Cell, task: AntTask = .resting) {
        self.id = id; self.caste = caste; self.cell = cell
        self.position = Position(cell); self.task = task
    }
}

public enum BroodStage: String, Codable { case egg, larva, pupa }
public struct Brood: Codable, Identifiable {
    public var id: Int
    public var age: Double
    public var cell: Cell
    public var stage: BroodStage { age < 45 ? .egg : age < 100 ? .larva : .pupa }
}
public struct ColonyEvent: Codable, Identifiable {
    public var id: Int
    public var time: Double
    public var text: String
}

public struct Colony: Codable {
    public var world: World
    public var ants: [Ant] = []
    public var brood: [Brood] = []
    public var food = 65.0
    public var water = 55.0
    public var time = 0.0
    public var rng: RandomStream
    public var events: [ColonyEvent] = []
    public var nextID = 1
    public var foodDelivered = 0.0
    public var waterDelivered = 0.0
    public var births = 0
    public var deaths = 0
    public var lastEgg = 0.0
    public var lastPlan = 0.0
    public var lastDecay = 0.0
    public static let populationLimit = 120

    public init(seed: UInt64 = 287) {
        world = World(seed: seed); rng = RandomStream(seed: seed)
        ants.append(Ant(id: 0,caste: .queen,cell: world.nest,task: .queen))
        for i in 1...28 {
            let cell = i <= 12 ? Cell((i-6)*2,0) : Cell((i % 9)-4,10)
            ants.append(Ant(id:i,caste: i > 26 ? .soldier : .worker,cell:cell))
        }
        nextID = 29
        for i in 0..<6 { brood.append(Brood(id:nextID,age:Double(i)*22,cell:Cell(-10+i%4,10+i/4))); nextID += 1 }
        record("A new colony takes root.")
    }

    public var day: Int { Int(time / 600) + 1 }
    public var workers: Int { ants.filter { $0.caste == .worker }.count }
    public var isAlive: Bool { ants.contains { $0.caste == .queen } }

    public mutating func record(_ message: String) {
        events.insert(ColonyEvent(id: (events.first?.id ?? -1)+1, time:time, text:message),at:0)
        if events.count > 6 { events.removeLast() }
    }

    /// Call with the fixed 0.1 second step. The UI never controls individual ant outcomes.
    public mutating func step(_ dt: Double = 0.1) {
        guard dt > 0, dt <= 1, dt.isFinite else { return }
        time += dt
        food = max(0,food-Double(ants.count)*dt*0.0035)
        water = max(0,water-Double(ants.count)*dt*0.0022)
        if time-lastDecay >= 2 {
            world.pheromones = world.pheromones.mapValues { $0*0.91 }.filter { $0.value > 0.035 }
            lastDecay = time
        }
        if time-lastPlan > 12 {
            let desired = 180 + ants.count*5 + brood.count*3
            if world.excavated.count + world.construction.count < desired { world.planRoom() }
            lastPlan = time
        }
        for i in ants.indices {
            var ant = ants[i]
            update(&ant,dt:dt)
            ants[i] = ant
        }
        // Deposition can affect an ant already updated earlier in this tick.
        for i in ants.indices where !world.isWalkable(ants[i].cell) {
            let safe = Cell(ants[i].cell.x,world.surface(at:ants[i].cell.x)-1)
            ants[i].cell = safe; ants[i].position = Position(safe); ants[i].route = []
        }
        let lost = ants.filter { $0.health <= 0 }
        if !lost.isEmpty {
            deaths += lost.count
            if lost.contains(where: { $0.caste == .queen }) { record("The queen has died. Start a new colony when you're ready.") }
            ants.removeAll { $0.health <= 0 }
        }
        updateBrood(dt)
    }

    private mutating func update(_ ant: inout Ant, dt: Double) {
        ant.age += dt
        ant.energy = max(0.03,ant.energy-dt*0.0008)
        if food < 0.1 || water < 0.1 { ant.health = max(0,ant.health-dt*0.0015) }
        else { ant.health = min(1,ant.health+dt*0.0008) }
        if ant.caste == .queen { return }

        // A deposited tile can invalidate a route. Recover to its new surface, never remain inside soil.
        if !world.isWalkable(ant.cell) {
            ant.cell = Cell(ant.cell.x,world.surface(at:ant.cell.x)-1)
            ant.position = Position(ant.cell); ant.route = []
        }
        if !ant.route.isEmpty {
            let next = ant.route[0]
            if !world.isWalkable(next) {
                ant.route = []
                if let target = ant.target, let route = world.path(from:ant.cell,to:target) { ant.route = route }
                return
            }
            let dx = Double(next.x)-ant.position.x, dy = Double(next.y)-ant.position.y
            let distance = hypot(dx,dy)
            let speed = (ant.caste == .soldier ? 2.7 : 3.0) * (ant.carried > 0 ? 0.76 : 1) * (0.8+ant.energy*0.2)
            let travel = speed*dt
            if distance <= travel {
                ant.cell = next; ant.position = Position(next); ant.route.removeFirst()
                if ant.task == .returningFood || ant.task == .returningWater {
                    world.pheromones[next] = min(4,(world.pheromones[next] ?? 0)+0.25)
                }
            } else {
                ant.position.x += dx/distance*travel; ant.position.y += dy/distance*travel
            }
            return
        }
        guard time >= ant.busyUntil else { return }
        switch ant.task {
        case .returningFood, .returningWater:
            guard ant.cell.distance(to:world.nest) < 3 else { send(&ant,to:world.nest); return }
            if ant.task == .returningFood { food += ant.carried; foodDelivered += ant.carried }
            else { water += ant.carried; waterDelivered += ant.carried }
            ant.carried = 0; ant.trips += 1; ant.experience += 1; ant.energy = min(1,ant.energy+0.12)
            chooseJob(&ant)
        case .toFood, .toWater:
            if let patchIndex = world.patches.firstIndex(where: { $0.cell == ant.cell && $0.amount >= 0.5 }) {
                let amount = min(2.5,world.patches[patchIndex].amount)
                world.patches[patchIndex].amount -= amount
                ant.carried = amount; ant.memory = ant.cell
                ant.task = world.patches[patchIndex].kind == .food ? .returningFood : .returningWater
                send(&ant,to:world.nest)
            } else { ant.memory = nil; ant.task = .exploring; explore(&ant) }
        case .toDig:
            guard let site = ant.target, world.isSolid(site), site.distance(to:ant.cell) <= 1.01 else { chooseJob(&ant); return }
            ant.task = .digging; ant.busyUntil = time + 1.8 + Double(max(0,site.y-25))*0.025
        case .digging:
            if let site = ant.target, world.excavate(site) {
                ant.carried = 1; ant.task = .haulingSoil; ant.experience += 1
                // Stay on an accessible neighbor. The new tile is open for every ant.
                send(&ant,to: Cell(world.depositSite().x,world.surface(at:world.depositSite().x)-1))
            } else { chooseJob(&ant) }
        case .haulingSoil:
            if ant.cell.y > 0 { send(&ant,to:Cell(0,0)); return }
            let site = world.depositSite()
            if abs(ant.cell.x-site.x) > 1 { send(&ant,to:Cell(site.x,world.surface(at:site.x)-1)); return }
            world.depositSoil(at:site)
            ant.carried = 0; ant.trips += 1
            ant.cell = Cell(ant.cell.x,world.surface(at:ant.cell.x)-1); ant.position = Position(ant.cell)
            chooseJob(&ant)
        case .exploring:
            if !discoverResource(&ant) { explore(&ant) }
        case .resting:
            if ant.cell.distance(to:world.nest) < 7 { ant.energy = min(1,ant.energy+0.35) }
            chooseJob(&ant)
        case .nursing:
            ant.energy = min(1,ant.energy+0.03); ant.busyUntil = time+3
            if rng.int(0...4) == 0 { chooseJob(&ant) }
            else { send(&ant,to:Cell(rng.int(-12 ... -8),rng.int(9...10))) }
        case .patrolling:
            send(&ant,to:Cell(rng.int(-10...10),0)); ant.busyUntil = time+2
        case .queen: break
        }
    }

    private mutating func send(_ ant: inout Ant, to cell: Cell) {
        // Dig tasks use target for the solid work tile, so callers restore it after routing.
        ant.target = cell
        if let path = world.path(from:ant.cell,to:cell) { ant.route = path }
        else {
            ant.route = []
            // A temporarily inaccessible destination must never discard cargo.
            if ant.carried == 0 { ant.task = .resting }
            ant.busyUntil = time+2
        }
    }

    private mutating func chooseJob(_ ant: inout Ant) {
        ant.target = nil; ant.route = []
        if ant.energy < 0.30 { ant.task = .resting; ant.busyUntil = time+8; send(&ant,to:world.nest); return }
        if ant.caste == .soldier { ant.task = .patrolling; send(&ant,to:Cell(0,0)); return }
        let specialization = ant.id % 7
        if food < 22 || water < 15 || specialization <= 2 {
            ant.task = .exploring
            if !discoverResource(&ant) { explore(&ant) }
        } else if specialization <= 5, assignDig(&ant) {
            return
        } else {
            ant.task = .nursing; send(&ant,to:Cell(-10,10)); ant.busyUntil = time+2
        }
    }

    private mutating func assignDig(_ ant: inout Ant) -> Bool {
        let reserved = Set(ants.filter { $0.id != ant.id && ($0.task == .toDig || $0.task == .digging) }.compactMap(\.target))
        for site in world.construction.prefix(120) where world.isSolid(site) && !reserved.contains(site) {
            let neighbors = site.adjacent.filter { world.isWalkable($0) }.sorted { $0.distance(to:ant.cell) < $1.distance(to:ant.cell) }
            for neighbor in neighbors {
                if let path = world.path(from:ant.cell,to:neighbor) {
                    ant.task = .toDig; ant.route = path; ant.target = site; return true
                }
            }
        }
        return false
    }

    private mutating func discoverResource(_ ant: inout Ant) -> Bool {
        let preferred: ResourceKind = water < min(25,food*0.65) ? .water : .food
        let sensed = world.patches.filter { patch in
            patch.amount >= 0.5 && (patch.cell.distance(to:ant.cell) <= 7 || patch.cell == ant.memory)
        }.sorted {
            let a = $0.cell.distance(to:ant.cell) + ($0.kind == preferred ? 0 : 20)
            let b = $1.cell.distance(to:ant.cell) + ($1.kind == preferred ? 0 : 20)
            return a == b ? $0.id < $1.id : a < b
        }
        if let patch = sensed.first {
            ant.task = patch.kind == .food ? .toFood : .toWater
            send(&ant,to:patch.cell); return !ant.route.isEmpty || ant.cell == patch.cell
        }
        return false
    }

    private mutating func explore(_ ant: inout Ant) {
        ant.task = .exploring
        if ant.cell.y > 0 { send(&ant,to:Cell(0,0)); return }
        if discoverResource(&ant) { return }
        let nearby = world.neighbors(of:ant.cell).filter { $0.y <= 0 }
        let scented = nearby.sorted { (world.pheromones[$0] ?? 0) > (world.pheromones[$1] ?? 0) }
        if let next = scented.first, (world.pheromones[next] ?? 0) > 0.1, rng.int(0...3) != 0 {
            ant.route = [next]; ant.busyUntil = time+0.1
        } else {
            let range = 38 + min(120,Int(time/90)*4)
            let direction = ant.id % 2 == 0 ? 1 : -1
            let targetX = rng.int(4...range)*direction
            send(&ant,to:Cell(targetX,world.surface(at:targetX)-1))
        }
    }

    private mutating func updateBrood(_ dt: Double) {
        let nurses = ants.filter { $0.task == .nursing }.count
        let healthy = food > 1 && water > 1
        if healthy {
            for i in brood.indices { brood[i].age += dt * (nurses > 0 ? 1 : 0.25) }
        }
        let mature = brood.filter { $0.age >= 150 }
        for baby in mature where ants.count < Self.populationLimit {
            var ant = Ant(id:baby.id,caste: .worker,cell:baby.cell)
            ant.bornAt = time; ants.append(ant); births += 1
            record("\(ant.name) emerged. The colony is growing.")
        }
        let bornIDs = Set(ants.map(\.id))
        brood.removeAll { bornIDs.contains($0.id) }
        if isAlive && healthy && time-lastEgg >= 24 && brood.count < 18 && ants.count+brood.count < Self.populationLimit {
            let cell = Cell(-11+nextID%4,9+nextID%2)
            brood.append(Brood(id:nextID,age:0,cell:cell)); nextID += 1
            food -= 1.8; water -= 0.8; lastEgg = time
        }
    }

    public mutating func place(_ kind: ResourceKind, x: Int) {
        world.addResource(kind,at:x)
        record(kind == .food ? "Fresh food placed on the surface." : "A water source appeared on the surface.")
    }
}
