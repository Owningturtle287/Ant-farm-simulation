# Little Colony · Ant Farm Simulator

A native iPhone ant-farm game in an original retro pixel-art cutaway. This is the first playable implementation: a small living colony that forages, carries water, excavates rooms, builds a surface mound, and raises brood.

## Get the iPhone build

Open **[GitHub Actions](https://github.com/Owningturtle287/Ant-farm-simulation/actions/workflows/ios.yml)** and download the iPhone artifact from a successful run. See **[installation instructions](docs/INSTALL.md)** for unsigned re-signing and optional signed ad hoc builds.

The native app requires **iOS 17 or later** and runs in landscape. GitHub hosts the source and downloadable builds; the game runs offline on your phone.

## What is playable

- A queen, 26 workers, two patrolling soldiers, and an initial brood.
- Autonomous exploration, local resource discovery, remembered sources, pheromone signals, food and water transport.
- Real excavation and soil accounting: workers carry removed earth into a growing mound.
- A construction plan that adds underground space as the colony needs it.
- Eggs, larvae, pupae, emerging workers, resource consumption, starvation, and queen loss.
- Individually inspectable ants with caste, task, age, energy, health, experience, trips, and a reason for their behavior.
- Animated procedural pixel sprites, textured soil, tunnel walls, trees, grass, clouds, and original app artwork.
- Drag / pinch camera controls, ant following, dense-cluster selection, pause, and 1× / 2× / 4× speed.
- Food and water placement, optional pheromone display, a colony roster, and a first-run guide.
- Versioned local autosaves, atomic writes, backup recovery, and explicit confirmation before a new colony.

## Controls

Drag to explore. Pinch to zoom. Tap an ant to open its profile; repeated taps cycle through overlapping ants.

| Control | Action |
| --- | --- |
| Food / Water | Select a resource, then tap the world to place it on the surface |
| Trails | Show pheromone signals |
| Nest | Return the camera home |
| Colony | Open the population roster and select an individual |
| More | Save, open the guide, or start a new colony |
| Pause / speed | Pause or run at 1×, 2×, or 4× |

The colony rests while the app is closed. Menus pause simulation. Autosaves run every 20 seconds and when leaving the app.

## Build and verification

No third-party game dependencies are required.

```sh
python3 scripts/generate_project.py
swift test --parallel
open AntFarm.xcodeproj
```

Select the **AntFarm** scheme in Xcode. For a physical phone, choose your signing team and a matching bundle identifier/provisioning setup.

Actions uses **macOS 15 / Xcode 16.4** to run simulation tests, build the simulator and physical-device app, exercise UI controls, capture actual simulator screenshots, and upload the device IPA. Optional manual signed builds use Apple credentials stored in GitHub secrets.

The tests cover complete resource / digging / birth loops across multiple seeds, soil conservation, walkable routes, deterministic replay, save/load continuation, recovery from a corrupt primary save, and starvation. An XCUITest checks pause, speed, ant inspection, follow, and resource placement.

## Good stopping point for v0.1

This version establishes a working colony loop and a reusable native foundation. It deliberately caps population at **120 ants**. The terrain can be queried and generated beyond the starting scene, and construction adds deeper rooms, but large-world storage streaming and very large populations are not finished.

Behavior is a game abstraction, not a complete biological brain. Source memory and pheromones are present; sophisticated individual learning is a later milestone. Soldiers patrol; predators, combat, drones, mating flights, disease, detailed weather/fluid physics, sound/haptics beyond placement feedback, and offline catch-up remain future work.

Physical-device installation, thermal behavior, and battery use require testing on actual iPhones. CI simulator success must be reported separately from those checks.

## Project layout

- `Sources/AntFarmCore/`: deterministic simulation, terrain, navigation, and saves.
- `AntFarm/`: native game scene, pixel rendering, controls, and interface.
- `Tests/AntFarmCoreTests/`: simulation and persistence checks.
- `AntFarmUITests/`: native interaction smoke test.
- `scripts/`: reproducible Xcode project/art generation and build helpers.
- `.github/workflows/ios.yml`: iPhone validation and downloadable builds.
- `docs/ROADMAP.md`: the staged plan for later expansion.
