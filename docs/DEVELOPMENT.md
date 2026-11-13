# Continue from the browser / Home Screen version

The primary delivery is now the GitHub Pages web app in `web/`, deployed by `.github/workflows/pages.yml`. Its stable URL can be bookmarked or added to an iPhone Home Screen. The earlier Swift prototype is retained below as historical implementation guidance.

- `web/sim.mjs` ports the colony model, navigation, resource loops, brood, and soil accounting into a seeded JavaScript core. It also records soil abandoned by ants that die while hauling.
- `web/persistence.mjs` owns the web save envelope, primary/backup recovery, and blocked autosave when prior progress is unreadable. Web saves are distinct from native saves.
- `web/render.mjs` draws original pixel art and invalidates changed terrain chunks. `web/app.mjs` connects touch controls, UI, game clock, and browser lifecycle.
- `web/sw.js` caches the complete app under its repository scope. `scripts/build-web.mjs` fingerprints source files into each service-worker cache version and produces `dist/`.
- Run `node --test tests-web/sim.test.mjs` and build with `node scripts/build-web.mjs`. Browser tests check Chromium and WebKit, phone layouts, controls, save restoration, Home Screen metadata, and actual offline reload under `/Ant-farm-simulation/`.
- All production asset URLs must remain relative. Do not change the live bookmark URL during normal updates. Preserve local save compatibility when changing the model.
- iPhone hardware performance and real Home Screen installation remain separate manual checks. CI uses desktop Chromium and emulated iPhone WebKit.

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
