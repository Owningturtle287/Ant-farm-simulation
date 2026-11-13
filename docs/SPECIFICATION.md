# Simulation specification · revision 1

## Product contract

An offline, single-player iPhone observation sandbox. In a continuous 2D side-view cutaway, ants build an aboveground mound, excavate connected passages and chambers, gather resources, and raise brood. The player influences conditions rather than micromanaging each ant. Visual craft, legible behavior, and reliable long-lived colonies are the priorities.

Default platform: iOS 17+, landscape left or right, iPhone only. Performance baseline: iPhone 11 / A13, to be measured on hardware. No account, network service, subscriptions, ads, or external AI is required for simulation.

## Biological reference and deliberate abstractions

Use **Pheidole pallidula** as the first behavioral reference: distinct minor and major worker castes fit the requested workers and soldiers. Major workers also perform colony work; they are not a permanently idle combat class. Physical caste and current job are separate fields. An adult minor does not level up into a major.

| Caste / stage | Planned behavior |
| --- | --- |
| Queen | Egg production, feeding, grooming, and relocation by colony responses. Does not issue orders. Start with one mated queen as a scenario choice. |
| Minor worker | Foraging, excavation, transport, brood care, maintenance, and defense as local needs change. |
| Major worker / soldier | Species-informed defense and food handling, plus colony work. Not locked to fighting. |
| Reproductive female | Produced only under suitable mature-colony conditions; distinct from the founding queen. |
| Male / drone | Reproductive role, not a worker profession. Mating flights initially resolved as a simplified event. |
| Egg, larva, pupa | Development and care demand; no adult-style locomotion or work decisions. |

The 2D cutaway, accelerated lifecycle, readable sprite scale, simplified moisture/temperature fields, and visibly expanding mound are game abstractions. The mound is an excavated-material deposit, not a claim that every natural P. pallidula nest makes a towering hill. Early tuning values are hypotheses, not measured biological constants.

Primary references:

- [Social task regulation in P. pallidula](https://pmc.ncbi.nlm.nih.gov/articles/PMC3014662/) — minor/major work and flexibility.
- [Social structure and nestmate recognition](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0156440) — caste and colony structure; the single-queen start is not a species-wide claim.
- [Route learning and trail pheromones in Lasius niger](https://pubmed.ncbi.nlm.nih.gov/22972897/) — evidence for memory plus pheromone navigation in another species. Treat transfer to this game's model as an explicit abstraction pending species-specific validation.

## Player loop

Observe a colony → inspect individuals and environmental overlays → place modest food/water sources or adjust sandbox conditions → let local ant decisions adapt → watch construction and brood development → inspect why the colony changed.

Launch scenario eventually begins with a founding queen and a small starting colony so the first minutes contain visible activity. A queen-only founding scenario can follow later. Provide pause and 1×/2×/4× simulation speeds when simulation exists. Never show a fake running clock in this design milestone.

## Resource and construction model

- Food has at least carbohydrate energy and protein value; water and brood care constrain growth.
- Soil hardness changes digging effort. Moisture affects suitability of spaces. Initial model uses fields, not a costly free-surface fluid simulation.
- Excavation consumes ant effort and produces a measured carried load. Removed material becomes a carried item and then a deposit. Resource quantities may not silently duplicate.
- A traversable tunnel must connect through actually excavated cells. Ants cannot path through unexcavated soil or teleport between chambers.
- Crowding, brood distribution, storage demand, transport distance, and local conditions stimulate further work. There is no all-knowing queen planner.
- Chambers emerge around local work targets, with bounded geometric preferences to keep the 2D nest navigable. These preferences are simulation abstractions and must be documented.
- Materials mean soil, stone obstacles, organic matter, and carried resources; no unexplained building currency.

## Individual brain contract

Per-ant processing: sense a bounded neighborhood → update needs and memories → score eligible jobs/actions → execute a small action state machine → record outcomes. Shared environmental pheromone fields diffuse/decay locally at a controlled cadence. Ants do not know global food locations or other ants' private memories.

Start with route/resource memory and bounded changes in action preferences after success or failure. Record the cause of the current action for the inspector. Memories can become stale. Exploration remains possible after a preferred route fails. Learning must persist across saves, remain bounded in size, and be testable with repeatable seeds. This is a behavioral model, not a neuron-level replica or an LLM per ant.

## Ant inspection data contract

Every adult has a stable ID, caste, sex, age, health, energy, hydration, nutritional state, current job/action, carried item and quantity, action reason, experience summary, and selected memories. Values requiring inference, such as a preference score, are labelled as model values rather than literal emotions. Developmental stages expose suitable stage/progress/care fields instead.

Inspection supports tapping, an ambiguity picker for clusters, an accessible list, focus/follow, and eventually favorites. The step-2 fixture exposes only illustrative age, health, energy, hydration, job, and carried item, clearly marked as sample data.

## World and persistence contract

No designed boundary in horizontal or downward expansion. Use signed 64-bit chunk coordinates and local cell coordinates; use camera-relative floats only for rendering. Sparse terrain storage is finite and constrained by disk space. Unlimited geography does not promise unlimited full-detail population.

Render only visible areas. Detailed simulation follows active interactions, including distant foragers, rather than the camera. Quieter areas can use cheaper updates without erasing individuals or changing the meaning of resources. Detailed/coarse transitions must conserve population, IDs, carried items, and important memories.

Later saves are versioned, transactional snapshots with recovery backups. Backgrounding requests a save. Default reopening resumes the saved colony; optional bounded offline advancement is a later explicit setting. No continuous background execution promise.

## Provisional performance budgets

| Metric | Target, not yet measured |
| --- | --- |
| Normal rendering | 60 fps on baseline hardware at ordinary zoom |
| Initial population envelope | Benchmark 100, 1,000, then 5,000 individuals; publish measured limits later |
| Simulation | Fixed 10 Hz starting point, staggered decisions, visually interpolated motion |
| Memory | Aim below 250 MB during ordinary play; verify using Instruments |
| Session | 30-minute thermal/battery profiling and multi-hour simulation soak |
| Loading | Budget established after first versioned save implementation |

When a speed setting cannot be sustained, display the achieved rate or reduce the requested speed visibly. Never silently skip resource accounting.

## Scope boundaries

First complete release: one species, one colony, all requested primary castes, expanding terrain and mound, resource-driven growth, inspectable individuals, local learning, polished pixel animation, and reliable saves. Multiple species, rival colonies, full fluid physics, multiplayer, cloud sync, and neural evolution are separate future decisions.
