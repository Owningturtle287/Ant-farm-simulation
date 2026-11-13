import Foundation

public struct Cell: Hashable, Codable, Comparable {
    public var x: Int
    public var y: Int
    public init(_ x: Int, _ y: Int) { self.x = x; self.y = y }
    public static func < (a: Cell, b: Cell) -> Bool { a.y == b.y ? a.x < b.x : a.y < b.y }
    public func distance(to other: Cell) -> Double { hypot(Double(x - other.x), Double(y - other.y)) }
    public var adjacent: [Cell] { [Cell(x-1,y), Cell(x+1,y), Cell(x,y-1), Cell(x,y+1)] }
}

public struct Position: Codable, Equatable {
    public var x: Double
    public var y: Double
    public init(_ cell: Cell) { x = Double(cell.x); y = Double(cell.y) }
}

public struct RandomStream: Codable {
    public var state: UInt64
    public init(seed: UInt64) { state = seed == 0 ? 0xA17FA4 : seed }
    public mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }
    public mutating func int(_ range: ClosedRange<Int>) -> Int {
        range.lowerBound + Int(next() % UInt64(range.upperBound - range.lowerBound + 1))
    }
}

public enum ResourceKind: String, Codable { case food, water }
public struct ResourcePatch: Codable, Identifiable {
    public var id: Int
    public var cell: Cell
    public var kind: ResourceKind
    public var amount: Double
}

public struct World: Codable {
    public var seed: UInt64
    public var excavated: Set<Cell> = []
    public var deposits: Set<Cell> = []
    public var patches: [ResourcePatch] = []
    public var construction: [Cell] = []
    public var plannedRooms = 0
    public var terrainRevision = 0
    public var soilExcavated = 0
    public var soilDeposited = 0
    public var pheromones: [Cell: Double] = [:]
    public let nest = Cell(0, 11)

    public init(seed: UInt64) {
        self.seed = seed
        for y in 1...12 { for x in -1...1 { excavated.insert(Cell(x,y)) } }
        carveChamber(center: Cell(0,11), rx: 6, ry: 3)
        for x in -11...11 { excavated.insert(Cell(x,8)); excavated.insert(Cell(x,9)) }
        carveChamber(center: Cell(-10,10), rx: 4, ry: 2)
        carveChamber(center: Cell(10,10), rx: 4, ry: 2)
        patches = [
            ResourcePatch(id: 0, cell: Cell(-19,0), kind: .food, amount: 140),
            ResourcePatch(id: 1, cell: Cell(25,0), kind: .food, amount: 180),
            ResourcePatch(id: 2, cell: Cell(13,0), kind: .water, amount: 180),
            ResourcePatch(id: 3, cell: Cell(-36,0), kind: .water, amount: 120)
        ]
        planRoom()
    }

    private mutating func carveChamber(center: Cell, rx: Int, ry: Int) {
        for y in -ry...ry { for x in -rx...rx {
            if Double(x*x)/Double(rx*rx) + Double(y*y)/Double(ry*ry) <= 1.12 {
                excavated.insert(Cell(center.x+x, center.y+y))
            }
        } }
    }

    public func isSolid(_ cell: Cell) -> Bool {
        if deposits.contains(cell) { return true }
        return cell.y >= 1 && !excavated.contains(cell)
    }

    public func surface(at x: Int) -> Int {
        deposits.filter { $0.x == x }.map(\.y).min() ?? 1
    }

    public func isWalkable(_ cell: Cell) -> Bool {
        guard !isSolid(cell) else { return false }
        return cell.y > 0 || cell.y == surface(at: cell.x) - 1
    }

    public func neighbors(of cell: Cell) -> [Cell] {
        var candidates = cell.adjacent
        for dx in [-1,1] { for dy in [-1,1] {
            let diagonal = Cell(cell.x+dx,cell.y+dy)
            if !isSolid(Cell(cell.x+dx,cell.y)) || !isSolid(Cell(cell.x,cell.y+dy)) {
                candidates.append(diagonal)
            }
        } }
        return candidates.filter(isWalkable)
    }

    /// Breadth-first route over discovered passages and a bounded surface search.
    public func path(from start: Cell, to goal: Cell) -> [Cell]? {
        guard isWalkable(start), isWalkable(goal) else { return nil }
        if start == goal { return [] }
        let minX = min(start.x,goal.x,-20)-8, maxX = max(start.x,goal.x,20)+8
        let minY = min(start.y,goal.y,-6)-3, maxY = max(start.y,goal.y,18)+8
        var queue = [start], head = 0
        var previous: [Cell: Cell] = [start: start]
        while head < queue.count && head < 12000 {
            let current = queue[head]; head += 1
            for next in neighbors(of: current) where previous[next] == nil {
                guard next.x >= minX && next.x <= maxX && next.y >= minY && next.y <= maxY else { continue }
                previous[next] = current
                if next == goal {
                    var route = [next], cursor = current
                    while cursor != start { route.append(cursor); cursor = previous[cursor]! }
                    return route.reversed()
                }
                queue.append(next)
            }
        }
        return nil
    }

    public mutating func planRoom() {
        let depth = 20 + (plannedRooms / 2) * 10
        let side = plannedRooms % 2 == 0 ? -1 : 1
        var plan: [Cell] = []
        for y in 12...depth { for x in -1...1 { plan.append(Cell(x,y)) } }
        for x in 0...10 { for dy in 0...1 { plan.append(Cell(side*x,depth+dy)) } }
        for y in -3...3 { for x in -5...5 {
            if Double(x*x)/25 + Double(y*y)/9 <= 1.1 { plan.append(Cell(side*10+x,depth+y)) }
        } }
        let existing = Set(construction)
        var added: Set<Cell> = []
        construction.append(contentsOf: plan.filter { isSolid($0) && !existing.contains($0) && added.insert($0).inserted })
        plannedRooms += 1
    }

    public mutating func excavate(_ cell: Cell) -> Bool {
        guard cell.y > 0, isSolid(cell), cell.adjacent.contains(where: { isWalkable($0) }) else { return false }
        excavated.insert(cell)
        construction.removeAll { $0 == cell }
        terrainRevision += 1; soilExcavated += 1
        return true
    }

    public func depositSite() -> Cell {
        // Fill low columns first, forming two gradual shoulders around an open entrance.
        let candidates = (-12...12).filter { abs($0) >= 3 }.map { x in Cell(x, surface(at:x)-1) }
        return candidates.min {
            let a = Double(-$0.y) + Double(abs($0.x))*0.24
            let b = Double(-$1.y) + Double(abs($1.x))*0.24
            return a == b ? $0.x < $1.x : a < b
        }!
    }

    public mutating func depositSoil(at cell: Cell) {
        guard cell == Cell(cell.x,surface(at:cell.x)-1), abs(cell.x) >= 3 else { return }
        deposits.insert(cell); soilDeposited += 1; terrainRevision += 1
        // Move resource patches to the new surface, preserving their identity.
        for i in patches.indices where patches[i].cell.x == cell.x {
            patches[i].cell.y = surface(at:cell.x)-1
        }
    }

    public mutating func addResource(_ kind: ResourceKind, at x: Int) {
        let cell = Cell(max(-2000,min(2000,x)), 0)
        if let i = patches.firstIndex(where: { $0.kind == kind && $0.cell.x == cell.x }) {
            patches[i].amount += 80
        } else {
            patches.append(ResourcePatch(id: (patches.map(\.id).max() ?? 0)+1,
                cell: Cell(cell.x,surface(at:cell.x)-1), kind: kind, amount: 80))
        }
    }
}
