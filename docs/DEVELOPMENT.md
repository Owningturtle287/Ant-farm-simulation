# Continue from the browser / Home Screen version

The primary delivery is the GitHub Pages app in `web/`, deployed by `.github/workflows/pages.yml` to the same bookmark address. Preserve existing progress and the deployment pipeline when updating it.

## v0.3 web architecture and contracts

- `biology.mjs` owns seeded randomness, individual traits, age/stage helpers, defaults, and bounded growth controls. New colonies have 12 workers, one queen, and three brood; the default ceiling is 120, with experimental options up to 500.
- `materials.mjs` generates layered substrate and local moisture/temperature estimates. Compaction affects dig duration. Deposited spoil is a separate material and retains its origin.
- `sim.mjs` owns persistent colony/world state, local discovery and recruitment, bounded learning, demand-sensitive task decisions, nursing, construction, and mass accounting. No DOM or renderer state belongs in the model. All random simulation choices must use the saved seeded generator.
- Terrain navigation knows open geometry; resource discovery does not know distant availability. Avoid granting ants omniscient source updates. Chamber planning is still a colony-level abstraction; see `REALISM.md`.
- Preserve soil accounting: excavated = deposited + soil carried by living ants + abandoned soil. Failed routing must retain cargo. Lowering a population ceiling never culls existing ants.
- `clock.mjs` advances the same fixed 0.1-second ticks at every speed through 64×. A six-millisecond per-frame simulation budget and bounded backlog preserve interaction under load; actual speed may fall below requested speed. Do not replace this with larger biology steps.
- `render.mjs` caches visible 16-cell chunks with neighboring invalidation. Spoil must never receive grass. At high time lapse, draw current positions directly so smoothing does not cut across solid terrain between distant snapshots.
- `app.mjs` owns controls, local performance sampling/export, pause state, and browser lifecycle. The optional performance panel runs with the simulation. Dialogs and background suspension pause it; there is no offline catch-up.
- `persistence.mjs` writes envelope version 2 and reads versions 1 and 2 under the unchanged `little-colony.web.v1` key. The actual pre-update fixture in `tests-web/fixtures/v1-colony.json` verifies preservation of ants, terrain, mound, and elapsed time. Modern saves must continue seeded behavior exactly. A valid backup recovers a corrupt primary; unreadable progress blocks automatic overwrite.
- `sw.js` precaches every runtime module, icon, and document under the repository scope. `build-web.mjs` fingerprints source files into the cache version and builds `dist/`. New runtime files must be added to the explicit cache list. All production asset URLs remain relative.

## Verification and performance

Run `npm test`, `npm run benchmark`, and `npm run build`. The simulation suite checks multi-seed resource/excavation/emergence loops, migration, deterministic save continuation, recovery, shortages, local recruitment/care, fallible memories, substrate mechanics, sensible construction demand, soil conservation, and fixed-step time lapse.

Browser checks cover Chromium and WebKit, phone layouts, settings persistence, 64× interaction, material/mound screenshots, legacy saves, Home Screen metadata, and actual offline reopening under `/Ant-farm-simulation/`. CI must pass before Pages deploys.

Chromium checks reopening with network offline emulation. WebKit checks reopening after its actual origin server is stopped, requiring a service-worker response and failed uncached network probe. This avoids [Playwright's upstream offline-emulation bug](https://github.com/microsoft/playwright/issues/42775); it does not claim origin loss and airplane mode are identical disruptions.

The `simulation-performance` Actions artifact samples CPU simulation ticks at 13, 60, 120, 250, and 500 adults with a fixed seed. It separates warm-up costs and records median/p95 timings. This short initial-nest benchmark omits rendering and long-session terrain growth. Compare runs on the same hardware; these measurements are not physical iPhone capacity results.

For device tests: use More → Show performance and Export readings. Record the phone model/OS manually alongside JSON, requested speed, actual speed, FPS, frame cost, simulation/drawing cost, population, brood, and excavated space. Test growing colonies and long sessions in both orientations. Check thermals and battery before claiming a supported maximum population. No telemetry is uploaded by the game.

## Next increments

1. Calibrate one reference species and replace remaining colony-level assumptions with measured local mechanisms.
2. Add brood relocation, food sharing networks, waste handling, and richer encounter-based task feedback.
3. Profile real iPhones at increasing populations; add spatial/update optimizations only where measurements justify them.
4. Add persistent region streaming before promising practically unbounded altered terrain.
5. Add reproductive flights, weather, hazards, predators, audio, and further animation as separately verified increments.

## Earlier native v0.1 foundation

The first stopping point is the complete small-colony loop: resources are discovered, carried, consumed, and converted into population growth and underground space. Excavated soil is physically accounted for in cargo and surface deposits.

## Structure and contracts

- `Colony.step()` advances a fixed 0.1-second simulation tick. Random decisions use the saved seeded `RandomStream`; avoid system randomness inside simulation logic.
- `World` owns persistent terrain changes, resources, construction plans, navigation, and pheromones. Underground passages are walkable cutaway back walls; above-ground ants require a surface or adjacent solid wall.
- The default initial colony contains 29 ants and six brood. The 120-ant cap is a v0.1 performance guard, not a claim about maximum tested device capacity.
- Worker jobs depend on needs and a small specialization preference. Foraging uses a local seven-cell sensing radius, personal source memory, and pheromone cues. Terrain routing uses known passages; it is separate from resource discovery.
- Soil removed by excavation must equal soil deposited plus soil carried by living ants, unless a future feature explicitly accounts for lost cargo. Failed routing must preserve cargo.
- SpriteKit renders 16-by-16-cell terrain chunks. Texture invalidation includes neighboring chunks when terrain changes at an edge. Core state must remain independent of scene nodes.
- `GameController` owns the engine, publishes UI snapshots four times per second, and advances simulation from the scene clock. Menus and background suspension pause progress; no offline catch-up is implemented.
- `SaveStore` uses a version-1 JSON envelope, atomic primary writes, and a known-good backup. A wholly unreadable save blocks autosave until an explicit save or new-colony action. Future schema changes require migration and save-fixture tests.

## Verification

Run `swift test --parallel` on a Swift-equipped machine. It tests multi-seed six-minute colony runs, complete resource/digging/birth loops, soil conservation, walkable routes, tall-mound traversal, deterministic outcomes, save continuation, backup recovery, and starvation.

Run the AntFarm scheme's UI test on an iPhone simulator. It checks pause/resume, speed, roster selection, ant profiles, following, and food placement, and retains screenshots. The Actions workflow also builds a physical-device IPA and captures the running game.

When changing simulation behavior, rerun the full core suite. When changing native controls or rendering, also rerun the simulator UI test and inspect its screenshots. A compiled app alone is not gameplay verification.

Physical iPhone installation, frame-rate stability, thermal behavior, and battery use remain separate manual validation. Use an older supported iPhone before raising population limits or adding expensive simulation systems.

## Suggested next increments

1. Calibrate against one reference ant species: caste rules, diet, development times, realistic task changes, and reproductive behavior. The current accelerated lifecycle is tuned for observing a game.
2. Add richer task demand and chamber specialization. Preserve a debug explanation for each action and avoid giving ants global resource knowledge.
3. Add bounded route confidence, forgetting, and adaptation tests before describing the model as sophisticated individual learning.
4. Profile actual devices. Then add distant-colony update levels and persistent chunk streaming before increasing population scale.
5. Add predators and defense, drone/reproductive lifecycle, weather, hazards, audio, and further animation as independently tested increments.

Do not revive the superseded foundation branch by merging it. Continue from the current main tree and retain the passing Actions pipeline.
