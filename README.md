# Ant Farm Simulator

A planned native iPhone ant-colony simulation with an expanding 2D pixel-art world: surface mound, underground tunnels, chambers, and individually inspectable ants.

**Status:** fresh-start planning. This README replaces the previous placeholder. Game implementation has not been restarted.

## Repository and delivery

- Source of truth: this repository, starting from `main`.
- At inspection, `main` contained only this README; there was no application code to remove from that branch.
- The earlier `codex/steps-1-2-foundation` branch is superseded as an implementation starting point. Its code will not be merged into the fresh rebuild. Git history and that branch remain available as reference.
- The existing iOS Foundation Actions run failed in native fixture/interaction checks. Simulator launch and device packaging were skipped. A working delivery pipeline must be demonstrated before expanding the game.
- GitHub stores the source; GitHub Actions builds, checks, and packages the native app. The simulation runs locally on the iPhone.

## Product direction

- Landscape-first side-on cutaway showing the surface and underground together.
- Original retro pixel art with the readability and exploration feel of Terraria.
- Smooth walking, turning, climbing, digging, carrying, and interaction animations.
- A queen and small starting colony that can forage, raise brood, build, and expand.
- Food, water, usable nest space, materials, population, and environmental conditions influence growth.
- Tap an ant to inspect its identity, caste, current job, age, needs, health, experience, and current behavior.
- Drag and pinch to explore; select and follow an ant; pause and adjust simulation speed.
- Proposed sandbox controls let the player provide resources and influence conditions while ants perform colony work autonomously.
- Select one biological reference species before implementing caste and reproductive rules. Treat caste separately from changeable worker jobs.

## Architecture

The proposed stack is Swift, SpriteKit for the game scene, and SwiftUI for menus and inspector panels.

Keep these systems separate:

| System | Responsibility |
| --- | --- |
| Simulation core | Fixed-step world and ant state, seeded randomness, resource accounting, colony lifecycle, decisions |
| Terrain and navigation | Procedural chunks, excavation, deposits, chamber connectivity, routes that respond to terrain changes |
| Behavior and learning | Local sensing, pheromones, needs, task selection, individual memory, bounded adaptation |
| Presentation | Pixel art, animation, camera, effects, audio, touch selection, UI |
| Persistence | Versioned saves, chunk storage, backup recovery, migration, optional offline catch-up |
| Delivery | Automated checks, simulator and device builds, artifact labeling, signing, release packaging |

Simulation data must not depend on visible SpriteKit nodes. Rendering and simulation update rates can differ.

"Unlimited" means no designed map boundary. Generate terrain on demand, retain persistent changes, and load only relevant chunks. Storage, memory, and processing remain finite. Population capacity will be measured on supported devices.

## Build milestones

Each milestone has a concrete deliverable and an exit check. Keep changes scoped to one milestone at a time, and update this plan with verified results.

### 1. Fresh foundation and reliable GitHub Actions

**Deliver:** a minimal native app, documented project layout, a testable simulation core, and a reproducible CI workflow.

- Establish the minimum iOS version, oldest supported test iPhone, and provisional performance budget.
- Create fresh application, simulation, test, asset, and documentation directories.
- Pin and document the Xcode/toolchain combination used by Actions.
- Run meaningful core checks and an iOS build on pushes and pull requests.
- Add a small simulator launch check before expanding UI testing.
- Package a correctly labeled unsigned device IPA; keep simulator artifacts separate.
- Add a separately controlled signed distribution path when credentials and provisioning are available.

**Exit check:** a green Actions run produces the expected artifacts; validate the intended installation route on an actual iPhone when device access is available. Report simulator verification separately from physical-device verification.

### 2. Visual direction, animation, and touch controls

**Deliver:** a small interactive scene establishing the final visual language.

- Create an original palette, terrain scale, ant silhouettes, UI style, and animation standards.
- Show a mound, tunnel, chamber, vegetation, and sample ants.
- Implement drag, pinch, camera bounds for the sample, follow mode, and ant inspection.
- Use generous touch targets and disambiguation for overlapping ants.
- Preserve crisp pixels at supported zoom levels while keeping movement smooth.

**Exit check:** the scene is readable on a phone, ants are easy to select, and the camera and basic animation feel polished. Clearly distinguish demonstration animation from working simulation.

### 3. Expandable terrain, excavation, and movement

**Deliver:** a chunked world with real terrain modification and navigable passages.

- Generate repeatable terrain from a world seed.
- Load and unload chunks without losing edits.
- Implement floors, slopes, walls, and ceiling traversal.
- Update navigation after digging, obstruction, or deposits.
- Track removed soil: excavation produces material that ants carry and deposit into the mound.
- Begin with affordable soil and moisture rules; defer detailed fluid physics until the core simulation performs well.

**Exit check:** ants dig a connected passage and move the excavated soil above ground; revisiting unloaded areas preserves their state.

### 4. Individual ant behavior

**Deliver:** autonomous ants with persistent identities, needs, and comprehensible decisions.

- Add caste, job, age, health, energy, food needs, carried items, experience, and memory.
- Combine local sensory information, pheromone cues, internal needs, and task priorities.
- Implement exploration, resource discovery, carrying, returning home, recruitment, and recovery from blocked routes.
- Model the queen and reproductive ants according to the selected species.
- Add developer overlays for routes, pheromones, and the reason behind a decision.

**Exit check:** ants complete resource trips and adapt to obstacles without passing through solid ground, becoming permanently stuck, or relying on hidden knowledge of all resources.

### 5. First complete small colony

**Deliver:** the first genuinely playable simulation.

Connect foraging, feeding, brood development, population growth, resource demand, and excavation. Include food storage, brood care, waste handling, mortality, inspection, and basic save/load.

**Exit check:** a modest colony survives and develops across several fixed seeds. Resource shortages and failures have identifiable causes. This milestone must be interesting to watch before increasing scale.

### 6. Need-driven nest construction and lifecycle depth

**Deliver:** colonies that expand their mound and underground layout in response to conditions.

- Represent demand for nursery space, storage, waste areas, entrances, and connecting routes.
- Use crowding, travel cost, moisture, and local work signals to influence construction.
- Let individual ants perform the excavation, transport, and deposition.
- Add species-appropriate specialization, defense, and reproductive behavior.
- Keep construction heuristics explicit so their effects can be tested and tuned.

**Exit check:** expansion supports colony needs, maintains usable paths, and produces varied nests without endless purposeless digging.

### 7. Individual learning and adaptation

**Deliver:** experience that changes behavior in measurable ways.

- Remember productive locations, useful routes, repeated failures, and relevant hazards.
- Use bounded updates to preferences and confidence.
- Combine remembered information with pheromone cues.
- Allow forgetting and renewed exploration when conditions change.
- Preserve each ant's learning state in saves.

This is a biologically informed behavioral model, not a claim to reproduce a complete ant brain. Large neural models and per-ant language-model calls are outside the initial design.

**Exit check:** experienced ants improve in controlled scenarios and can abandon an unproductive learned route after the environment changes.

### 8. Scale, persistence, and device performance

**Deliver:** measured colony capacity, reliable long sessions, and durable progress.

- Render only relevant terrain and visible entities.
- Stagger decisions and reuse suitable navigation information.
- Update distant activity less frequently while preserving identities, resource accounting, and important events.
- Benchmark increasing populations on real hardware; target smooth 60 fps at normal speed on the chosen baseline device, subject to measured feasibility.
- Measure heat, battery use, memory, load time, and save size.
- Add autosaves, backup recovery, save migration, and interruption handling.
- Define optional bounded offline catch-up; do not depend on continuous execution while iOS suspends the app.

**Exit check:** extended sessions remain within documented device budgets, and saved colonies restore correctly after interruption and updates.

### 9. Polish and release

**Deliver:** a cohesive, tested build distributed through GitHub Actions.

Refine animation transitions, antenna movement, carrying poses, digging effects, lighting, audio, haptics, interface feedback, onboarding, and simulation balance.

Validate resource starvation, blocked passages, population spikes, fast-forward, dense ant selection, large saves, application interruptions, and installation.

**Exit check:** the release build passes the defined gameplay, save compatibility, installation, and performance checks. Publish its version, commit, change notes, artifact link, and installation instructions.

## Actions deployment design

| Trigger | Planned behavior |
| --- | --- |
| Pull request / development branch | Core checks, build validation, small simulator smoke check, diagnostic results |
| Successful main build | Downloadable preview artifacts labeled by version and commit |
| Manual signed build | Validate supplied signing configuration, archive/export, upload signed IPA |
| Release tag | Repeat required checks and package versioned release assets through Actions |

Do not report a build as installable merely because an IPA file exists.

- A simulator app does not run on a physical iPhone.
- An unsigned IPA requires an appropriate re-signing/install process.
- Ad hoc distribution requires valid Apple signing and provisioning for the registered device.
- The earlier workflow referenced signing secrets, but their availability has not been verified.
- Actions artifact links have retention limits. Versioned release assets can provide longer-lived download links.
- Keep signing material in repository/environment secrets, never source files or logs.

## First substantial playable target

A polished small colony that digs tunnels, transports soil into a mound, gathers food, raises brood, supports individual ant inspection, and saves correctly.

Complete that loop before expanding world complexity or promising a particular maximum population.
