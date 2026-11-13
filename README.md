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

- Animated pixel ants, forest, soil, tunnels, chambers, and a growing surface mound.
- A queen, workers, patrolling soldiers, brood development, and population growth.
- Autonomous foraging, source memory, pheromone signals, food/water transport, and excavation.
- Tap ants for personal stats, job, experience, and behavior explanations.
- Drag / pinch navigation, ant following, pause, and 1× / 2× / 4× speed.
- Food/water placement, colony roster, local autosaves, recovery copy, and JSON export.
- Portrait and landscape phone layouts, Home Screen icon, and offline reopening.

Population is capped at **120 ants**. Advanced learning, predators, combat, reproductive drones, weather, very large populations, and persistent world streaming remain future milestones. The colony rests while the page is closed or hidden.

## GitHub Actions

**Deploy Little Colony** checks the simulation, builds the offline app, and runs Chromium and WebKit browser checks. Passing builds deploy to GitHub Pages.

The workflow's **deploy** box and run summary contain the clickable live URL. Browser artifacts contain screenshots and test evidence. Future pushes that change web code update the same bookmark address.

Asset and service-worker URLs respect the repository subpath. Each build fingerprints its offline cache, replacing this game's old cache versions.

## Development

No external runtime libraries or network services are needed to play.

```sh
node --test tests-web/sim.test.mjs
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
