import Foundation

public struct SaveEnvelope: Codable {
    public var version = 1
    public var savedAt = Date()
    public var colony: Colony
    public init(colony: Colony) { self.colony = colony }
}
public enum SaveError: Error { case unsupportedVersion, invalidState }

public struct SaveStore {
    public let directory: URL
    public var primary: URL { directory.appendingPathComponent("colony-v1.json") }
    public var backup: URL { directory.appendingPathComponent("colony-v1.backup.json") }
    public init(directory: URL) { self.directory = directory }

    public func save(_ colony: Colony) throws {
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(SaveEnvelope(colony:colony))
        // Only promote a known-good primary to the recovery copy.
        if let old = try? Data(contentsOf:primary), (try? decode(old)) != nil {
            try old.write(to:backup,options:.atomic)
        }
        try data.write(to:primary,options:.atomic)
    }

    public func decode(_ data: Data) throws -> Colony {
        let envelope = try JSONDecoder().decode(SaveEnvelope.self,from:data)
        guard envelope.version == 1 else { throw SaveError.unsupportedVersion }
        let colony = envelope.colony
        guard colony.time.isFinite, colony.time >= 0, colony.food.isFinite, colony.water.isFinite,
              colony.ants.count <= Colony.populationLimit,
              Set(colony.ants.map(\.id)).count == colony.ants.count,
              colony.ants.allSatisfy({ $0.position.x.isFinite && $0.position.y.isFinite })
        else { throw SaveError.invalidState }
        return colony
    }

    public func load() throws -> (colony: Colony, recovered: Bool)? {
        guard FileManager.default.fileExists(atPath:primary.path) || FileManager.default.fileExists(atPath:backup.path) else { return nil }
        if let data = try? Data(contentsOf:primary), let colony = try? decode(data) { return (colony,false) }
        if let data = try? Data(contentsOf:backup), let colony = try? decode(data) { return (colony,true) }
        throw SaveError.invalidState
    }
}
