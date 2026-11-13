import XCTest
@testable import AntFarm

final class ReferenceWorldTests: XCTestCase {
    func testBundledReferenceWorldIsInspectable() throws {
        let world = try ReferenceWorld.load()
        XCTAssertEqual(world.species, "Pheidole pallidula")
        XCTAssertEqual(world.ants.count, 14)
        XCTAssertNotNil(world.ants.first { $0.id == "C-027" })
        XCTAssertTrue(world.ants.contains { $0.caste == "Queen" })
        XCTAssertTrue(world.ants.contains { $0.caste == "Major / soldier" })
        XCTAssertNotNil(Bundle.main.url(forResource: world.image, withExtension: "png"))
    }

    func testInvalidCoordinatesCannotBecomeSelectionTargets() throws {
        let data = Data("""
        {"width":100,"height":100,"image":"ReferenceWorld","species":"Test",
         "samplePopulation":1,"sampleBrood":0,"trail":[],"ants":[
         {"id":"bad","caste":"Minor worker","job":"Forager","action":"Sample",
          "reason":"Fixture","carriedItem":"None","ageDays":1,"health":100,
          "energy":100,"hydration":100,"x":101,"y":10}]}
        """.utf8)
        let world = try JSONDecoder().decode(ReferenceWorld.self, from: data)
        XCTAssertThrowsError(try world.validate())
    }
}
