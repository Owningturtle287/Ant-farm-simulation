import Foundation

struct ReferenceWorld: Decodable {
    let width: Double
    let height: Double
    let image: String
    let species: String
    let samplePopulation: Int
    let sampleBrood: Int
    let ants: [ReferenceAnt]
    let trail: [ReferencePoint]

    static func load(bundle: Bundle = .main) throws -> ReferenceWorld {
        guard let url = bundle.url(forResource: "reference-world", withExtension: "json") else {
            throw ReferenceError.missingResource
        }
        let world = try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
        try world.validate()
        return world
    }

    func validate() throws {
        guard width > 0, height > 0, !ants.isEmpty,
              samplePopulation >= ants.count, sampleBrood >= 0,
              Set(ants.map(\.id)).count == ants.count else {
            throw ReferenceError.invalidFixture
        }
        for ant in ants {
            guard ant.x >= 0, ant.x <= width, ant.y >= 0, ant.y <= height,
                  (0...100).contains(ant.health), (0...100).contains(ant.energy),
                  (0...100).contains(ant.hydration), ant.ageDays >= 0 else {
                throw ReferenceError.invalidFixture
            }
        }
        guard trail.allSatisfy({ $0.x >= 0 && $0.x <= width && $0.y >= 0 && $0.y <= height }) else {
            throw ReferenceError.invalidFixture
        }
    }
}

struct ReferenceAnt: Decodable, Identifiable, Equatable {
    let id: String
    let caste: String
    let job: String
    let action: String
    let reason: String
    let carriedItem: String
    let ageDays: Int
    let health: Int
    let energy: Int
    let hydration: Int
    let x: Double
    let y: Double
}

struct ReferencePoint: Decodable {
    let x: Double
    let y: Double
}

enum ReferenceError: Error {
    case missingResource
    case invalidFixture
}
