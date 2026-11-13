import XCTest
@testable import AntFarmCore

final class ColonyTests: XCTestCase {
    func testRoutesStayInOpenConnectedTerrain() throws {
        let world = World(seed:17)
        let route = try XCTUnwrap(world.path(from:Cell(-30,0),to:world.nest))
        XCTAssertFalse(route.isEmpty)
        var prior = Cell(-30,0)
        for cell in route {
            XCTAssertTrue(world.isWalkable(cell))
            XCTAssertTrue(world.neighbors(of:prior).contains(cell))
            prior = cell
        }
        XCTAssertEqual(prior,world.nest)
        XCTAssertNil(world.path(from:world.nest,to:Cell(60,50)))
    }

    func testColonyCompletesResourceDiggingAndBirthLoops() {
        for seed: UInt64 in [17,287,914] {
            var colony = Colony(seed:seed)
            for _ in 0..<3600 { colony.step() }
            XCTAssertGreaterThan(colony.foodDelivered,0,"food seed \(seed)")
            XCTAssertGreaterThan(colony.waterDelivered,0,"water seed \(seed)")
            XCTAssertGreaterThan(colony.world.soilExcavated,0)
            XCTAssertGreaterThan(colony.world.soilDeposited,0)
            XCTAssertGreaterThan(colony.births,0)
            XCTAssertTrue(colony.isAlive)
            XCTAssertLessThanOrEqual(colony.ants.count,Colony.populationLimit)
            let carried = colony.ants.filter { $0.task == .haulingSoil }.reduce(0) { $0+Int($1.carried) }
            XCTAssertEqual(colony.world.soilExcavated,colony.world.soilDeposited+carried)
            XCTAssertTrue(colony.ants.allSatisfy { colony.world.isWalkable($0.cell) })
        }
    }

    func testIdenticalSeedsAndInputsProduceSameOutcome() throws {
        var a = Colony(seed:88), b = Colony(seed:88)
        for i in 0..<600 {
            if i == 200 { a.place(.food,x:7); b.place(.food,x:7) }
            a.step(); b.step()
        }
        XCTAssertEqual(a.food,b.food)
        XCTAssertEqual(a.world.excavated,b.world.excavated)
        XCTAssertEqual(a.ants.map(\.cell),b.ants.map(\.cell))
        XCTAssertEqual(a.rng.state,b.rng.state)
    }

    func testSaveRoundTripContinuesSimulationAndRecoversBackup() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:directory) }
        let store = SaveStore(directory:directory)
        var original = Colony()
        for _ in 0..<700 { original.step() }
        try store.save(original)
        var loaded = try XCTUnwrap(store.load()).colony
        for _ in 0..<300 { original.step(); loaded.step() }
        XCTAssertEqual(original.food,loaded.food)
        XCTAssertEqual(original.ants.map(\.position),loaded.ants.map(\.position))
        try store.save(loaded)
        try Data("broken".utf8).write(to:store.primary)
        let recovered = try XCTUnwrap(store.load())
        XCTAssertTrue(recovered.recovered)
        XCTAssertEqual(recovered.colony.time,70,accuracy:0.001)
    }

    func testStarvationAndInputValidation() {
        var colony = Colony()
        colony.food = 0; colony.water = 0; colony.world.patches = []
        colony.ants = colony.ants.filter { $0.caste == .queen }
        for _ in 0..<7000 { colony.step() }
        XCTAssertFalse(colony.isAlive)
        let time = colony.time
        colony.step(.nan); colony.step(-1); colony.step(100)
        XCTAssertEqual(colony.time,time)
    }
}
