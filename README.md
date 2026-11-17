# Little Colony · Ant Farm Simulator

**[Open the game](https://owningturtle287.github.io/Ant-farm-simulation/)** · **[Deployment workflow](https://github.com/Owningturtle287/Ant-farm-simulation/actions/workflows/pages.yml)**

A playable, offline-capable pixel-art ant farm for iPhone and the browser. Open the live link in Safari and add it to your Home Screen. The icon opens a standalone web app.

## Save it to your phone

1. Open the game link in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Enable **Open as Web App** if shown, then tap **Add**.
4. Open the **Little Colony** icon.

The first online visit caches the game for offline reopening. Progress saves locally on your device. See [phone instructions](docs/INSTALL.md).

## Playable features

- Animated pixel ants on seeded, contoured grassland. Bare, asymmetrical mound pellets contrast with rooted dirt and soft earth. Trees and hard/stone layers are removed.
- A single reproductive queen and continuously sized small, medium, and large red imported fire-ant workers. White eggs, segmented larvae, and ant-shaped pupae develop through local care, prey protein, and nest conditions. The queen moves within sheltered rooms, visibly lays eggs, and receives food from attendants; nurses physically carry eggs and relocate brood.
- Stimulus-driven task selection using nutritional need, local signals, age, size and experience. Large workers are not locked into guarding. Antennal recognition, bounded food/water sharing, recruitment, fallible source memories, and short alarm responses.
- **More → Fire ant behavior** explains the model; **More → Disturb the ground** demonstrates a local alarm. Trails shows food, water, brood, queen, home and alarm cues.
- All ground is diggable. Transported soil retains its origin, and colony-specific deposition preferences and slopes shape uneven mounds. Workers propose and dig narrow peripheral mouths and passages through mound soil. Rehandled soil is conserved.
- Discrete water, nectar and insect portions shrink as picked up. Empty carcasses never refill; later wildlife creates a new finite entity. Nutrition separates carbohydrate energy from protein.
- Seed-bearing grass clumps wither when fully harvested, then sprout and mature again. Intermittent rain collects in terrain depressions; puddles refill, evaporate, and are harvested.
- Tap ants for personal stats, job, experience, and behavior explanations.
- Drag / pinch navigation, ant following, pause, and 1× / 2× / 4× / 8× / 16× / 32× / 64× / 128× time lapse.
- Separate egg-laying and brood-development controls, configurable starting size, and a population ceiling.
- Optional live FPS, simulation/drawing cost, actual speed, and population readings with JSON export. No telemetry leaves your device.
- Food/water placement, colony roster, local autosaves, recovery copy, and JSON export.
- Portrait and landscape phone layouts, Home Screen icon, and offline reopening.

New colonies start with **12 workers and one queen**, plus three brood. The default population ceiling is **120**, adjustable through 20, 40, 60, 100, 120, 200, 250, 500, 750, 1,000, 2,000, 2,500, 5,000, 7,500 and 10,000. Higher ceilings are experimental; they do not establish a tested iPhone capacity. Existing saves keep their ants, terrain and settings while behaviors upgrade and old patrol loops are released. **Start a new colony for the revised fire-ant founder nest and peripheral mouth.**

This is a research-informed, accelerated model of **Solenopsis invicta**, using its single-queen social form. It does not reproduce an exact neural brain. Its biological time and physical scale are gameplay approximations. Quantitative biological calibration, a complete trophallaxis/larval-processing network, rival colonies, reproductive flights, flooding physics, and persistent world streaming remain future milestones. The colony rests while the page is closed, hidden, or a menu is open. See [model and research notes](docs/REALISM.md).

## GitHub Actions

**Deploy Little Colony** checks the simulation, builds the offline app, and runs Chromium and WebKit browser checks. Passing builds deploy to GitHub Pages.

The publication job and run summary contain the clickable live URL. Browser artifacts contain screenshots and test evidence. Publication requires the simulation tests, the 120-day default run, and both browser suites. Optional capacity measurements run separately through **Measure Little Colony performance → Run workflow**; they do not delay publication. Its `simulation-performance` artifact contains CPU-only measurements, not an iPhone rendering or battery benchmark. Future pushes that change web code update the same bookmark address.

Asset and service-worker URLs respect the repository subpath. Each build fingerprints its offline cache, replacing this game's old cache versions.

## Development

No external runtime libraries or network services are needed to play.

```sh
node --test tests-web/sim.test.mjs
node scripts/benchmark-sim.mjs
node scripts/build-web.mjs
node scripts/serve-web.mjs
```

Open `http://localhost:4173/Ant-farm-simulation/`.

For browser checks: `npm install`, `npx playwright install chromium webkit`, then `npm run test:browser`.

- `web/`: simulation, fire-ant responses, signals, finite resource accounting, nest architecture, ecology, renderer, UI and offline assets.
- `tests-web/`: simulation/save checks and browser playthrough/offline checks.
- `scripts/build-web.mjs`: static output and cache versioning.
- `.github/workflows/pages.yml`: tested GitHub Pages publishing.

The earlier Swift/SpriteKit prototype remains in `AntFarm/` and `Sources/AntFarmCore/`. Its optional native workflow runs when native files change or when requested manually; see [native build instructions](docs/NATIVE_INSTALL.md). The web app is the primary phone delivery format.

See [continuation notes](docs/DEVELOPMENT.md) and the [original roadmap](docs/ROADMAP.md).


The v0.6 terrain update adds supported low mound slopes, narrow shallow entrances, roofed/spaced mound galleries, curved passage plans and varied organic chamber outlines. Fine pixel textures and subcell cutaway contours replace full-cell square boundaries. Older unstable mounds settle once using their existing soil; the colony and its stores remain.


v0.7 addresses camera lag: detailed terrain is painted in a worker, with a 24 MiB LRU bitmap cache, zoom-dependent detail, small visible margins and a bounded fallback. Biology ticks yield between batches while preserving the same fixed-step rules. Distant overlapping crowds use fewer redundant draw calls; every ant still has its own simulated state. The roster loads 100 ants at a time. Large colonies use chunked IndexedDB generations with a recoverable backup instead of exceeding localStorage capacity. Saving holds biology at a completed tick while the camera remains available. The 10,000 ceiling is experimental; it is not a promise of 128× or a fixed frame rate on an iPhone.


v0.8 adds a local sensorimotor layer: separately sampled moving antennae, gradual acceleration and turning, rounded waypoint passing, local body avoidance and brief bounded scouting samples. Distance-driven tripod gait frames and articulated head/antenna poses replace the four-frame clock animation. Pheromone trails use soft connected ribbons, with separate food-odor and moisture halos, a matching legend and left/right readings in the ant profile. Existing colonies upgrade in place; the 120 default and 10,000 experimental ceiling remain unchanged.


v0.9 adds separate size-dependent food/water crop bars, contact-based transfers, and visible food parcels in the nest. Personal feeding comes first; full ants carry solid excess into reserved cache space. Water remains in crops. Supplies and brood share a collision-free item lattice, and each egg, larva or pupa needs a separate bed. Crowding creates construction demand. A seeded, deep groundwater horizon supplies finite exposed seeps; dry spells can prompt local downward moisture probes. Groundwater depth is adjustable from 24 to 240 game cells (default 56), and the camera can zoom out to 0.10×. Rain, pool shimmer, splashes and ripples have been updated.


v0.10 adds physical adult body spacing, adjacent work positions, separate idle locations, local yielding and route replanning. Brood and food placements preserve travel lanes. The queen shifts her laying position as nearby beds fill, and nurses collect eggs from beside her. Eggs, curled larvae and pale ant-shaped pupae have distinct pixel art and molt/emergence effects. Roofed air gaps beneath mounds are navigable even without an excavation tag, and contour turns keep the navigation anchor aligned with the continuous body position. Old overlapping adults are unpacked into free space, adding a recorded holding annex only when necessary. The 10,000 ceiling remains experimental.
