# Native architecture

## Decision

Swift, SpriteKit, and SwiftUI, using Apple frameworks only. This is a native iPhone project, not a web wrapper. SpriteKit owns the world and gestures inside the scene; SwiftUI owns accessible controls, sheets, and inspection. Default bundle ID: `com.owningturtle.antfarm`. Minimum iOS: 17.0. Initial development toolchain: Xcode 16 or newer; CI reports its actual Xcode version.

## Current foundation

`AntFarmApp` → `DesignPreviewView` → `DesignPreviewModel` → `ReferenceColonyScene`.

The native scene loads `reference-world.json`, displays nearest-filtered concept artwork, maps static inspectable ant hotspots, and implements pan, pinch, zoom, recenter, selection, focus, and a reference pheromone trail. `ReferenceWorld` validates the fixture contract. The concept artwork and hotspot data are checked in together; the fixture does not generate or animate the illustrated ants.

Reference state is intentionally separate from future simulation state. No timers advance sample ants. The scene exposes selection callbacks and camera commands only. No gameplay behavior should be inferred from these fixtures.

## Simulation modules to introduce in step 3 and later

| Module | Responsibility | Must not depend on |
| --- | --- | --- |
| `SimulationCore` | Fixed ticks, seeded RNG, IDs, units, invariants | SpriteKit, SwiftUI, wall clock |
| `WorldStore` | Chunks, terrain edits, environmental fields, connectivity | Camera or screen dimensions |
| `AntSystem` | Needs, sensory queries, job scoring, action execution, bounded memories | Scene nodes |
| `ColonySystem` | Brood and resource accounting, lifecycle | Omniscient orders to workers |
| `Navigation` | Local paths and a connected tunnel graph; invalidation after edits | Fresh global A* search for every ant every frame |
| `Persistence` | Versioned snapshots, journal/recovery, migrations | Native view hierarchy |
| `Presentation` | Read-only render snapshots, animations, inspector summaries | Authority to mutate state while drawing |

Simulation initially lives on a dedicated serial executor/actor. Rendering consumes immutable snapshots on the main actor, interpolating positions between ticks. Player intents enter a command queue at tick boundaries. Replay records seed, scenario, and commands. Specific actor boundaries will be verified against measured copying cost before optimization.

## Terrain design

Start with 64×64-cell chunks as a tunable engineering value. Persist seed-derived generation plus edits and mutable fields. Use Int64 chunk addresses; never create a world-sized array. Keep spatial queries local. Store stable entity data independently from render nodes. Offset rendered positions relative to the camera to avoid far-origin precision problems.

The reference fixture describes a finite 1672×941-pixel concept image and 14 selection hotspots; it is not the production world implementation.

## Quality rules

- Deterministic seeded scenarios for simulation tests.
- Explicit conservation tests for soil, food, brood, carried loads, and chunk transitions.
- No unbounded route history or per-frame allocations proportional to explored world size.
- Rendering culling and simulation activity are independent decisions.
- Pixel textures use `.nearest`; camera translations snap in display space where useful. Continuous gesture motion must remain comfortable.
- Native controls keep 44-point minimum touch targets; small world objects use a larger hit radius and a list alternative.
- Signed distribution never depends on checked-in credentials. Pull-request builds require none.

## Verification limits

Linux can validate JSON, scripts, project references, generated reference art, and source hygiene. It cannot compile or run the iOS application. GitHub Actions macOS builds and simulator runs provide that evidence. Physical iPhone installation, touch ergonomics, battery, and thermal budgets remain separate hardware checks until performed.
