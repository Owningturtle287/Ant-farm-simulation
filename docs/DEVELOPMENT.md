# Continue from the browser / Home Screen version

The primary delivery is the GitHub Pages app in `web/`, deployed by `.github/workflows/pages.yml` to the same bookmark address. Preserve existing progress and the deployment pipeline when updating it.

## v0.7 web architecture and contracts

- `fire-ant.mjs` owns the single-queen species profile, continuous worker size, contact-odor recognition, crop capacities and task response scores. `signals.mjs` handles local cue emission, sampling and decay. `resources.mjs` owns finite stock accounting and discrete visible resource portions. `architecture.mjs` generates founder connections and worker-proposed exits/mound passages.
- `biology.mjs` owns seeded randomness, individual traits, age/stage helpers, defaults, and bounded growth controls. New colonies have 12 workers, one queen, and three brood; the default ceiling is 120, with experimental options up to 10,000.
- `materials.mjs` generates layered substrate and local moisture/temperature estimates. All depths are equally diggable. Deposited spoil is a separate visual material and retains its origin. `ecology.mjs` owns seeded contours, grass harvest/regrowth, basin detection, rain scheduling, accumulation, and evaporation. Separate saved randomness keeps weather deterministic.
- `sim.mjs` owns persistent colony/world state, local discovery and recruitment, bounded learning, demand-sensitive task decisions, nursing, construction, and mass accounting. No DOM or renderer state belongs in the model. All random simulation choices must use the saved seeded generator.
- Terrain navigation knows open geometry; resource discovery does not know distant availability. Avoid granting ants omniscient source updates. Chamber planning is still a colony-level abstraction; see `REALISM.md`.
- Preserve soil accounting: excavated = deposited + soil carried by living ants + abandoned soil. Failed routing must retain cargo. Lowering a population ceiling never culls existing ants.
- `clock.mjs` advances the same fixed 0.1-second ticks at every speed through 128×. A six-millisecond per-frame simulation budget and bounded backlog preserve interaction under load; actual speed may fall below requested speed. Do not replace this with larger biology steps.
- `render.mjs` caches visible 16-cell chunks with neighboring invalidation. Spoil must never receive grass. At high time lapse, draw current positions directly so smoothing does not cut across solid terrain between distant snapshots.
- `app.mjs` owns controls, local performance sampling/export, pause state, and browser lifecycle. The optional performance panel runs with the simulation. Dialogs and background suspension pause it; there is no offline catch-up.
- `persistence.mjs` writes envelope version 4 and reads versions 1–4 under the unchanged `little-colony.web.v1` key. Actual pre-update fixtures in `tests-web/fixtures/v1-colony.json` and `v2-colony.json` and `v4-colony.json` verify preservation of ants, terrain, mound, and elapsed time. Modern saves must continue seeded behavior exactly, including weather and in-flight brood. Old saves retain a flat `terrainVersion: 0`; newly created colonies use contoured `terrainVersion: 1`. Preserve established terrain except the explicit soil-preserving v0.6 correction of unstable mounds and wide shallow breaches. A valid backup recovers a corrupt primary; unreadable progress blocks automatic overwrite.
- `sw.js` precaches every runtime module, icon, and document under the repository scope. `build-web.mjs` fingerprints source files into the cache version and builds `dist/`. New runtime files must be added to the explicit cache list. All production asset URLs remain relative.

## Verification and performance

The regression suite also exercises finite-source transfers, resource ledger balance, water/protein search persistence, size-independent task changes, odor-based recognition, actual trail-biased movement, temporary alarms, mound re-excavation, migration of patrol jobs, and multiple accelerated generations.

Run `npm test`, `npm run benchmark`, and `npm run build`. The simulation suite checks multi-seed resource/excavation/emergence loops, migration, deterministic save continuation, recovery, shortages, local recruitment/care, fallible memories, soft earth at every depth, sensible construction demand, soil conservation, fixed-step time lapse, seed depletion/regrowth, rain basins, queen movement/laying, physical egg transport, and queen provisioning outside the central store.

Browser checks cover Chromium and WebKit, phone layouts, settings persistence, 128× interaction, rain/grassland/mound and nursery screenshots, legacy saves, Home Screen metadata, and actual offline reopening under `/Ant-farm-simulation/`. CI must pass before Pages deploys.

Chromium checks reopening with network offline emulation. WebKit checks reopening after its actual origin server is stopped, requiring a service-worker response and failed uncached network probe. This avoids [Playwright's upstream offline-emulation bug](https://github.com/microsoft/playwright/issues/42775); it does not claim origin loss and airplane mode are identical disruptions.

The `simulation-performance` Actions artifact samples CPU simulation ticks at 13–10,000 adults with a fixed seed. It separates warm-up costs and records median/p95 timings. This short initial-nest benchmark omits rendering and long-session terrain growth. Compare runs on the same hardware; these measurements are not physical iPhone capacity results.

For device tests: use More → Show performance and Export readings. Record the phone model/OS manually alongside JSON, requested speed, actual speed, FPS, frame cost, simulation/drawing cost, population, brood, and excavated space. Test growing colonies and long sessions in both orientations. Check thermals and battery before claiming a supported maximum population. No telemetry is uploaded by the game.

## Behavior contracts

Movement uses `destination` for the walkable route endpoint, separately from a solid dig target. Do not route diggers to the solid tile they plan to remove. Cargo has an explicit `cargoKind`; food/water must never become excavated soil during replanning. Purposeful resting/grooming and busy intervals are not stalled routes. The movement auditor only resets active work after actual lack of positional progress.

Resource stock must balance environmental inputs against remaining amounts, harvest, evaporation, decay and burial. Never refill a harvested insect entity: ecological arrivals create a new ID. Food cargo carries its nutrient composition so nectar cannot become protein during transfer.

The queen's position is independent of the central store. Attendants must visit the store and then reach her before feeding. Newly laid brood exists at her current position. `carriedBy` and each carrier's `carryingBrood` must agree; release brood on carrier death and avoid adult emergence during transit. Nursery candidate scores are cached for five seconds with terrain-revision invalidation and included in save state to preserve deterministic continuation.

## Next increments

1. Quantitatively calibrate the selected S. invicta model and replace remaining colony-level shortcuts with measured local mechanisms.
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

## v0.5 invariants and regression scope

Large workers have no permanent patrol override. Defense requires a sensed alarm and has a bounded investigation interval. Familiar contact activates search without copying a remote source coordinate. A source memory can record nutritional type only after local discovery. Brood cue salience is multiplied by current care demand so a large, well-tended brood pile does not permanently trap all workers in nursing. Satiation attenuates recruitment and allows reserves to rest even while nearby foragers return.

The adult population limit and the supportable replacement brood pool are separate. Ready pupae can wait at the player ceiling. Changes in brood schedules migrate stage and within-stage progress, rather than rescaling the total age indiscriminately. Existing adults retain prior lifespan expectations during migration.

Mound re-excavation decreases `soilDeposited`, increases `soilRehandled`, and puts the same soil into cargo. It does not increment original `soilExcavated`. Old surface geometry remains unchanged. New mouths are registered as planned until a real path connects them to the nest.

Microclimate samples use a saved two-second moisture-source snapshot. Numeric cache epochs, brood-ID reuse, and avoiding unchanged population-array copies reduce hot-path work. These caches must never make saved continuation diverge. The six-millisecond frame budget remains in effect through 128×; requested speed is not a promise that every phone/population achieves it.

`node scripts/endurance-sim.mjs report.json [seed]` checks 120 modeled days at the default reproduction settings, using the production 0.1-second tick and no player inputs. It asserts population renewal, walkable occupancy and soil/resource conservation. Actions runs seed 287 and uploads its checkpoints with the CPU benchmark. This is a regression scenario, not proof that every seed or parameter combination is viable.


`geometry.mjs` owns connected cubic passage rasterization, seeded rotated/lobed chamber footprints and shared bilinear occupancy sampling. Renderer chunks use 16 texture pixels and 8 contour samples per model cell. Cache invalidation includes adjacent chunks; sampling is world-aligned across seams. Never draw exposed former mound galleries as sheltered back walls.

`World.geometryVersion` is independent of envelope/model version 4. On older malformed terrain, regrade the exact existing spoil inventory once, use some inventory to plug excess shallow breaches around protected mouth columns, and relocate affected occupants without loss. Stable old terrain is preserved. Keep the legacy-repair and modern deterministic-save tests.

Contour masks include narrow capsules along valid diagonal graph edges, preserving solid centers and blocked corner pairs. Nest framing fits the modified terrain below the HUD when opening a mature save or pressing Nest.


## v0.7 responsiveness contracts

`terrain-raster.mjs` takes compact, isolated geometry snapshots and returns transferable RGBA buffers. `terrain-worker.mjs` owns expensive contour/texture loops. The renderer keeps one worker request active, reorders pending work for the current view, retains stale/alternate-LOD images during refresh, and never synchronously paints a detailed chunk while drawing. `render-cache.mjs` bounds retained image bytes to 24 MiB. Only a one-cell margin is requested. Source detail changes with displayed pixel density; returning to an area reuses its cache. Worker failures use `rasterRows` in budgeted batches, not one blocking raster call. Reset epochs reject replies from an old colony. Full-detail pixels have a fixed checksum regression.

`SimulationRunner` schedules `Colony.tick()` generator batches within a per-frame CPU budget. `Colony.step()` exhausts the same generator for deterministic reference checks and server benchmarks. Ants, sensory updates, signals, physiology, brood and births still use fixed 0.1-second ticks. A started tick completes before saves, edits or exports; paused rendering can finish that pending tick. Derived brood indexes are excluded from saves. Local perception uses cell buckets, and known-brood membership uses a temporary set to avoid quadratic duplicate checks. All ants remain individually simulated. Crowded distant sprites and stacked brood limit redundant overlapping drawing; the selected ant and queen always render.

Small saves keep the original localStorage format. At 600 adults or 1,000 brood, `large-saves.mjs` uses IndexedDB: metadata and groups of 96 individuals are written as separate transactions, then one transaction switches the primary/backup manifest. Incomplete generations never become primary. Recovery retains the known-good backup when the damaged primary is replaced. Biology is held at a completed tick for this asynchronous copy; the camera and terrain worker continue. Large autosaves run less often and defer during gestures. Page-hide saving is best effort; the last complete generation remains authoritative if the browser terminates an in-progress write.

Browser checks attach camera timing reports, including a synthetic 10,000-adult/1,000-brood case, validate large-save reload and backup recovery, exercise the worker-off fallback, and cover offline worker/module loading. They are regression scenarios on Actions hosts, not a measured iPhone population capacity. The CPU benchmark reports whole-tick costs, including larger ticks that are split across browser frames. Keep actual-speed reporting honest under load.

During camera input the canvas temporarily uses a one-pixel-per-CSS-pixel backing store; after 180 ms of stillness the normal capped device pixel ratio returns. DOM text/controls stay at native resolution. This bounds pixel bandwidth on mobile compositors, while bitmap caches and colony state survive the resolution change. Browser detail-ready checks include this restoration.

An autosave request can start while a large tick is pending: the runner finishes that tick and holds further biology until the database generation commits. Do not require an already-idle runner to request an autosave, because continuous catch-up can otherwise starve saving indefinitely.

Crowd suppression uses screen-space buckets rather than allowing several opaque sprites at the same world-cell position. Very dense wide views use simple pixel silhouettes beyond a viewport-scaled rich-sprite budget; selected ants and the queen bypass that budget. This changes drawing only, not the simulated population or individual inspection.

The worker-off fallback caps terrain texture detail at eight pixels per cell to reduce per-chunk work. Its convergence check pauses biology so the target revision remains fixed; live fallback rendering may show an older bitmap while a changed chunk is repainted.

Database open/read failures also block automatic replacement of a marked large save; they must not silently switch the player to a new small colony.


## v0.8 movement contracts

`locomotion.mjs` owns persistent per-ant heading, speed, random stream, phase, slow pace variation and sampling cooldowns. Keep this state in modern saves; exact seeded continuation and cooperative/synchronous equivalence remain required. `initializeBrain` migrates missing motion state without altering terrain, IDs, cargo, brood or the population ceiling. Source-odor bins contain live patch references and are derived, omitted from world serialization. No additional full brood or population scans are added per ant: local encounters check at most eight bodies in three nearby occupancy bins.

Do not turn path waypoints into position teleports. Validate continuous segments against `densityAt`, including rounded diagonal portals and support near surface steps. A derived per-world revision map triggers body-overlap checks after soil changes; it must not enter saves. Bodies overlapped by new soil continuously move toward clear space while retaining their route. Corner recovery must preserve a carrier's task, destination and cargo. Scouting sampling pauses are bounded and excluded from loaded or urgent travel. Sensor tests must demonstrate a changed trajectory under a reversed left/right field, not only changed diagnostic readings.

`ant-art.mjs` bakes twelve gait frames plus a resting pose and sixteen antenna combinations into one atlas per body category. No six-leg path construction occurs for every visible ant on every frame. The renderer uses eased angles and velocity-linked cadence, retaining sprite culling and crowd budgets. `chemical-art.mjs` refreshes connected trail geometry at most four times per second, culls outside the viewport, batches strokes and reuses glow stamps. Keep this work bounded and preserve the camera, large-save and worker-off browser checks. New runtime modules are included in `sw.js` for offline reopening.
