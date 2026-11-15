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
- A queen, minor workers, and later major workers. White eggs, segmented larvae, and ant-shaped pupae develop through local care, seed nutrition, and nest conditions. The queen moves within sheltered rooms, visibly lays eggs, and receives food from attendants; nurses physically carry eggs and relocate brood.
- Flexible tasks shaped by demand, age, individual thresholds, and successful experience. Local recruitment, fallible source memories, distinct food/water trails, rest, grooming, and crowding.
- All ground is diggable. Transported soil retains its origin, and colony-specific deposition preferences and slopes shape uneven mounds. New space is requested as the colony grows.
- Seed-bearing grass clumps wither when fully harvested, then sprout and mature again. Intermittent rain collects in terrain depressions; puddles refill, evaporate, and are harvested.
- Tap ants for personal stats, job, experience, and behavior explanations.
- Drag / pinch navigation, ant following, pause, and 1× / 2× / 4× / 8× / 16× / 32× / 64× / 128× time lapse.
- Separate egg-laying and brood-development controls, configurable starting size, and a population ceiling.
- Optional live FPS, simulation/drawing cost, actual speed, and population readings with JSON export. No telemetry leaves your device.
- Food/water placement, colony roster, local autosaves, recovery copy, and JSON export.
- Portrait and landscape phone layouts, Home Screen icon, and offline reopening.

New colonies start with **12 workers and one queen**, plus three brood. The default population ceiling is **120**, adjustable to 60, 250, or 500. Higher ceilings are experimental; they do not establish a tested iPhone capacity. Existing saves keep their ants and terrain. **Start a new colony to generate contoured ground**; older colonies retain their original flat ground to protect established tunnels and mounds.

This is a generalized, accelerated soil-nesting ant model. Its biological time and physical scale are gameplay approximations. Exact species calibration, richer colony communication, predators, reproductive flights, flooding physics, and persistent world streaming remain future milestones. The colony rests while the page is closed, hidden, or a menu is open. See [model and research notes](docs/REALISM.md).

## GitHub Actions

**Deploy Little Colony** checks the simulation, builds the offline app, and runs Chromium and WebKit browser checks. Passing builds deploy to GitHub Pages.

The workflow's **deploy** box and run summary contain the clickable live URL. Browser artifacts contain screenshots and test evidence. The `simulation-performance` artifact records repeatable CPU-only samples at 13, 60, 120, 250, and 500 ants; it is not an iPhone rendering or battery benchmark. Future pushes that change web code update the same bookmark address.

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

- `web/`: simulation, canvas renderer, UI, manifest, icons, and service worker.
- `tests-web/`: simulation/save checks and browser playthrough/offline checks.
- `scripts/build-web.mjs`: static output and cache versioning.
- `.github/workflows/pages.yml`: tested GitHub Pages publishing.

The earlier Swift/SpriteKit prototype remains in `AntFarm/` and `Sources/AntFarmCore/`. Its optional native workflow runs when native files change or when requested manually; see [native build instructions](docs/NATIVE_INSTALL.md). The web app is the primary phone delivery format.

See [continuation notes](docs/DEVELOPMENT.md) and the [original roadmap](docs/ROADMAP.md).
