# Crops, space and groundwater · v0.9

The reference species is the red imported fire ant, **Solenopsis invicta**, using the **single-queen (monogyne)** social form. This is a mechanistic, research-informed game model. It is not a reconstruction of neurons, a fitted whole-colony biological model, or an exact ant brain.

## Reproduction and worker organization

The queen reproduces; the modeled workers are sterile females. Worker body size is continuous, assigned at emergence, and influenced by larval feeding. Small, medium, and large are descriptive UI categories, not fixed job assignments. Adults do not grow into a different caste. New small/medium/large workers use approximate 30–60 / 60–90 / 90–180 modeled-day lifespans; queens use a much longer range. Migrated adults retain their prior lifespan to avoid an abrupt conversion-related die-off.

Task decisions combine remembered nutritional demand, personal energy/hydration, age, size, experience, contact recruitment, nearby brood cues, construction stimuli, and local alarm. Large workers can collect prey and water, excavate, share food, or attend brood. There is no permanent soldier/patrol branch. Short alarm investigations end as the stimulus fades. Recruitable reserves and grooming/resting remain normal behavior.

The nominal warm, well-fed development schedule is 8 days as an egg, 10 as a larva, and 12 as a pupa. Temperature, moisture, care and larval nutrition alter it. The thermal curve loosely spans published warm/cool developmental differences; it is not a fitted physiological model. Larval feeding uses protein intake. Poor nutrition slows development and severe deprivation reduces vitality.

The default egg target rises with workers (`0.75 × worker count`, bounded at 3–1500 per modeled day), then the player multiplier applies. This is a small-colony gameplay scaling curve, not a measured fecundity regression. Food, water, queen health and supportable brood limit actual laying. The adult ceiling does not stop the colony maintaining replacement brood. Ready pupae wait when adult capacity is full—an explicit game limit, not natural fire-ant development.

## Perception, recognition and learning

Workers sample local signal concentrations and nearby resources. Short-distance body contact compares a familiar composite colony-odor template with the encountered ant's cues. Recognized contact can update that template, activate recruits, share bounded food/water, and relay previously acquired demand information. Recognition is not an ID comparison. The three-component odor vector and acceptance threshold are computational abstractions; the chemistry of recognition is more complex and not uniquely established by hydrocarbons alone.

Returning carriers lay fading trails. Antennae sample neighboring cells and gradients influence movement, with recent-cell avoidance and stochastic exploration. Contact activates resource search without transmitting a remote coordinate. A worker learns a source location and nutrient type through its own discovery; failed visits reduce reliability, impose a cooldown, and eventually remove the memory. Water searches do not repeatedly collect carbohydrates; protein searches can bypass seeds/nectar to look for prey. Satiation dampens recruitment to prevent a self-sustaining hoarding loop.

Food, water, home, alarm, queen and brood are **functional signal channels**, not claims about six separate chemical compounds in this species. Strengths, evaporation, diffusion and thresholds are game units. Food/water colors distinguish destinations for observation; the known trail chemistry is not recreated molecule by molecule. Queen and brood cues fade if their sources disappear. Disturbing ground near workers prompts a bounded alarm response; a click in empty ground creates no worker alarm.

Remembered passages and shared aggregate reserves still simplify navigation and nutrition. Brood memories and nursery geometry are abstracted. Learning means bounded successful-work gains, source reliability, contact templates and recent experience, not machine-learned neural weights.

## Finite resources and nutrition

Water and non-grass food are drawn as discrete portions, each representing up to two model units. Pickup removes exactly the carried quantity; empty sources have no resource squares. Collection, cargo transfer and consumption are distinct events. Nectar supplies energy; insect pieces supply mostly protein; seeds remain opportunistic mixed food. Food and protein counters now summarize physical parcels, crop contents and in-transit food; they are not remotely accessible stockpiles. Larval processing remains simplified.

Rain creates new water in topographic depressions. Plants can produce new grain or nectar after a delay. A harvested insect is never refilled: later wildlife inputs create a new finite entity with a new ID. Player-placed insect pieces and nectar drops do not regenerate. Uneaten insect pieces decay. Resource ledgers account for environmental inputs, remaining stock, harvested amounts, evaporation, decay and burial. These ecological inputs are accelerated game rules, not a calibrated field food web.

Grass dieback after complete seed harvest is retained from the requested game design; seed removal does not universally kill real grasses. Regrowth and rain make the ecosystem renewable while each available portion remains finite.

## Nest construction

New colonies start with a compact nest and a seeded, narrow **peripheral mouth**, linked by irregular subsurface passages. The center of the future mound is not a protected open canyon. Used passages, remembered space pressure, builder experience and accumulated soil prompt worker construction proposals. A shared queue and reservations coordinate their execution.

Deposited soil can be excavated again to produce narrow interior mound galleries. Existing roofs remain visible as cutaway back walls. Peripheral exits and mound passages are procedurally selected and physically dug, not instant teleports. Nursery selection considers stage-specific moisture/temperature and crowding, with hysteresis to avoid endless brood shuttling. All ground remains soft and diggable as requested. Deposition rejects protected galleries and unreachable candidates; route searches include the existing mound roof and known nest extent. Foraging can continue through aboveground galleries when the mound surrounds an older mouth. Loaded workers can interrupt work to replenish energy and hydration without losing cargo or transported brood.

This is still a candidate-plan architecture model, not fully emergent stigmergy or granular soil physics. Worker proposals use some colony-level state as a shortcut. Geometry, distance and metabolic time are not physically calibrated together. Flooding, collapse and ventilation physics are not modeled.

For soil accounting, excavation of original earth increases `soilExcavated`. Re-excavating deposited soil moves it from `soilDeposited` into cargo without manufacturing new earth; `soilRehandled` records that work. Always preserve:

`soilExcavated = soilDeposited + living soil cargo + soilAbandoned`

Existing colonies retain their original excavation records. Unstable older mounds and oversized shallow openings receive the soil-preserving correction described below. Their behavior and resource system upgrade in place, and old indefinite patrol jobs are released. Start a new colony for the fully revised founder nest. Developmental migration preserves both stage and within-stage progress.

## Research used

These sources support mechanisms and plausible ranges; none validates the exact coefficients above.

- [Tschinkel, 2011: The Organization of Foraging in the Fire Ant, Solenopsis invicta](https://pmc.ncbi.nlm.nih.gov/articles/PMC3391925/) — scouts, recruitable reserves, local activation from foraging tunnels, worker age and the underground foraging network.
- [Family before work: task reversion in S. invicta](https://www.nature.com/articles/s41598-023-29246-z) — brood-associated stimuli and task changes. This does not imply unlimited flexibility in every task or species.
- [Cassill & Tschinkel: Task selection by workers of the fire ant](https://digitalcommons.usf.edu/fac_publications/1000/) — worker task selection and the participation of large workers in food recruitment/storage.
- [Vander Meer, Alvarez & Lofgren, 1988: Isolation of trail recruitment pheromone](https://www.ars.usda.gov/ARSUserFiles/60360510/publications/Vander_Meer_et_al-1988%28M-1986%29.pdf) — orientation and recruitment components of trail signaling.
- [Vander Meer et al., 1989: Temporal changes in colony chemical patterns](https://pubmed.ncbi.nlm.nih.gov/24272300/) and [Obin, 1986: Environment and nestmate recognition](https://pubmed.ncbi.nlm.nih.gov/24305971/) — chemical context, environmental effects and changing recognition templates.
- [Anderson & Vander Meer, 2001: Experimental evidence concerning recognition cues](https://www.ars.usda.gov/arsuserfiles/60360510/publications/Anderson_and_Vander_Meer-2001%28M-3649%29.pdf) — a reason not to equate a hydrocarbon profile with a complete identity code.
- [Cassill, Tschinkel & Vinson, 2002: Nest complexity, group size and brood rearing](https://pure.lib.usf.edu/en/publications/nest-complexity-group-size-and-brood-rearing-in-the-fire-ant-sole-2/) — narrow mound galleries and connections with subterranean chambers.
- [Porter, 1988: Temperature, colony growth and developmental rates](https://www.sciencedirect.com/science/article/pii/0022191088902156) — strong temperature dependence of development.
- [Markin et al., 1972: Colony founding by S. invicta queens](https://academic.oup.com/aesa/article-abstract/65/5/1053/13950) — early colony development and favorable temperature ranges.
- [Fang et al.: Fire-ant embryogenesis](https://pmc.ncbi.nlm.nih.gov/articles/PMC12277563/) — observed egg development at controlled temperature.
- [Fire ants dry and store insect pieces](https://pmc.ncbi.nlm.nih.gov/articles/PMC3127378/) — protein collection and storage rather than a seed-only diet.
- [UF/IFAS species account](https://ask.ifas.ufl.edu/publication/IN352) — expert synthesis of life history, worker sizes and longevity ranges.

Next steps are quantitative calibration against one defined climate/diet regime, a fuller larval processing and food-sharing network, measured local excavation rules, and real-iPhone population/thermal tests. Rival colonies, mating flights, multiple-queen genetics, disease and waste handling remain future systems.


## v0.6 terrain correction

Mound deposition now checks both neighboring ground levels and a broader three-cell support span. Its search radius expands with soil volume, so accumulated pellets spread into a lower, asymmetric slope. An entrance protects a narrow mouth; it no longer permits an arbitrarily high adjacent wall. New mound branches connect from the nearest existing passage instead of repeatedly cutting new routes from the queen chamber. Internal mound galleries require an intact roof, lateral soil and spacing from other galleries, with a limited excavated share of the mound. An exposed old gallery is outdoor air, not a permanent sheltered chamber.

Passage candidates use curved centerlines with connected raster bridges; chambers use seeded rotated, lobed outlines. Navigation still uses a cell graph. The cutaway renderer resolves that graph at eight contour samples and sixteen texture pixels per cell, with continuous material shading, fine grains and pixel-stepped rounded boundaries. This increases visual contour detail; it is not a claim of granular soil mechanics or continuous collision physics.

When an older save contains an unstable mound or a wide near-surface breach, a one-time correction regrades its existing solid spoil. Some of the same spoil closes excess shallow openings around a retained narrow shaft. Remaining spoil forms a supported surface pile. Ant identities, brood, stores, elapsed time, soil totals and original excavation records survive. Surface occupants and occupants of filled cells move to valid nearby positions; carried brood stays with its carrier. Already stable mounds retain their layout. Geometry version 2 prevents repeated corrections on subsequent loads.

Regression coverage includes 1,500 deposition cycles across seeds with intermittent gallery digging, support/height checks, legacy repair, connected curved routes, contour chunk boundaries, mature 120-ant screenshots, close-up and portrait views. The 120-day Actions scenario now checks exterior slopes and gallery share as well as population and material accounting.


## v0.7 population experiments

Ceilings up to 10,000 are growth controls rather than biological changes or supported-device claims. The default remains 12 workers plus a queen and a 120-adult ceiling. Every ant retains individual physiology, memory, contact behavior and task decisions. Cooperative scheduling may slow simulated time under load; it does not replace ants with aggregate agents. At a distant view, overlapping sprites and brood are drawn with a density limit; selection always shows the selected ant. See the development notes for camera rendering, complete-tick saving and stress-test scope.


## v0.8 local sensing and movement

The two antenna tips move in body coordinates, each sampling interpolated local concentrations independently. Their left/right contrast bends steering and biases the next exploration choice. Nearby finite sources add a separate local food odor or moisture cue; a consumed source immediately ceases producing that cue. Water is represented by a moisture cue, not an assertion that ants smell liquid water as a pheromone. Signals remain six functional game channels, not a chemical reconstruction. The faint overlay colors are an observation aid; ants read numeric fields rather than pixels.

Heading changes are bounded; speed accelerates, slows into turns, and varies gradually between individuals. Look-ahead rounds traversable corners. Continuous body positions are collision-checked against the same interpolated soil contour as the renderer, with a support check for surface walking. Wall contact redirects toward the passage centerline rather than waiting indefinitely. When new soil overlaps a body, a bounded continuous escape reduces that overlap before the ant resumes its existing task. Short-range body encounters produce bounded passing adjustments and slowing; this is not a rigid-body or six-foot traction simulation.

Searching ants show correlated meanders and occasional 0.12–0.42-second sampling pauses with a 6–18-second cooldown. Strong cues narrow sampling; weak cues produce broader casting. Those values are game tuning, not measured species-specific rates or evidence of human-like distraction. Food/soil/brood carriers and urgent nutrition or queen-care travel retain their destination and are not randomly distracted. Scouts plan their next local step as they pass a waypoint, avoiding an artificial stop at every cell. Resting ants keep their feet planted while their antennae remain active.

Twelve cached alternating-tripod gait poses, separately indexed antenna poses, head motion and a restrained body bob animate the ant. Walking cadence responds to movement speed, with a presentation limit at extreme time lapse. Antenna pose and sensory sampling share one model; rendering interpolates its phase. Geometry and the local sampling strategy are simplified, research-inspired models. Stored paths and the existing nearby-resource identification range still simplify navigation.

Additional research:

- [Draft et al., 2018, Carpenter ants use diverse antennae sampling strategies to track odor trails](https://pubmed.ncbi.nlm.nih.gov/30266788/) documents distinct sampling behaviors and different left/right antenna use in **Camponotus pennsylvanicus**. Bilateral sampling and casting here extrapolate that mechanism to the game; the paper does not establish identical fire-ant motor parameters.
- [Gravish et al., 2013, Climbing, falling, and jamming during ant locomotion in confined environments](https://pmc.ncbi.nlm.nih.gov/articles/PMC3683784/) studies **S. invicta** and supports considering body, appendage and wall interactions in narrow passages. The game does not model falls or antenna-based jamming.
- [Comparative Quantification of Trail-Following Behavior in Pest Ants, 2020](https://www.mdpi.com/2075-4450/11/1/5) includes **S. invicta** and shows species differences in trail deviation and speed. Motion remains restrained rather than applying a large generic zigzag to every ant.


## v0.9 crops, food caches and individual space

Food and water have separate displayed crop budgets, both increasing with body size. The food budget contains energy-bearing and protein components. These are functional game compartments, not a claim that a real ant has two independent crop organs. Body energy/hydration remain separate from held supplies. Ants consume their own contents, and antennal encounters can move a bounded amount between crops without manufacturing nutrients. Queen attendants and nurses must obtain and carry their food before feeding locally. A nurse with no spare crop volume can carry a solid food parcel from a cache to a larva in its mandibles, preventing a full carbohydrate crop from blocking protein feeding. Protein can provide metabolic energy when necessary, and queen egg production consumes local nutrients. Nutrient accounting includes collection, consumption and losses.

When body energy and the food crop are full, excess carried food is placed into individual dry nest spaces. Ants retrieve specific parcels when supplies are needed. Each parcel holds at most two game units; a partly consumed parcel shrinks and disappears when empty. Stored food may represent any requested food type, including liquid-derived nutrients as a game extension. Documented fire-ant prey drying/storage supports solid insect caches; it does not establish that every type of liquid food is cached. Liquid water is never made into a nest cache. The header counts food energy plus protein and water held in crops.

Every resource portion and food parcel reserves one third-cell lattice slot. Every grounded egg, larva and pupa reserves a whole cell, excluding other items from that bed. A carried brood item reserves a destination while in transit; physical placement checks that the bed is still free. Abandoned claims are removed when colony demand is refreshed. There is no hidden stacking or visual suppression of multiple brood items at one bed. Adult movement and carried items are not rigid-body collision simulations. Free-bed and storage shortages encourage new excavation; normal play cannot conjure completed storage rooms.

Old virtual reserves are materialized once. Crowded older brood is separated while retaining IDs, stages, nutritional state and elapsed time. If an old inventory cannot fit, a one-time annex supplies migration space; the removed original earth is included in both excavation and removed-earth accounting. Existing food is retained as parcels. Old water first fills available crops; overflow is released outside, with unretained runoff explicitly counted rather than made into indoor storage. Outside portions unable to fit a legacy source's available space are counted as buried material. Modern saves preserve exact seeded continuation.

## v0.9 groundwater and drought

The default groundwater horizon is about 56 game cells below the reference surface, with independently seeded, smooth lateral contours. Rain/dry periods shift it slowly, and a player depth change moves gradually toward its target. The setting spans 24–240 cells. Distances are game units, not calibrated meters. Fully saturated openings are unsuitable for ant travel; the earth remains diggable, with no stone layer.

During a shortage or prolonged dry surface conditions, workers can propose short descending probes from explored ground, using nearby moisture conditions. Workers then physically excavate and haul the earth. Water scouts can investigate accessible lower passages. A source is learned only after local detection; the brain receives no remote aquifer coordinates. Digging avoids the saturated extreme and can expose a capillary fringe. An exposed column has a finite 48-unit reserve, at most two units available at its seep, and a bounded release rate. Rain can recharge it. Moving horizons drain obsolete seeps and expose others. This is a bounded reservoir/capillary-fringe model, not a Darcy-flow or flooding-physics solver.

Surface puddles evaporate during dry spells, with natural depressions determining space and capacity. Rain admits actual finite portions; water that cannot occupy a source is not silently stacked. Rain graphics use varying streaks, surface splashes, pool shimmer and localized ripples.

Research supporting the direction of this update:

- [Tschinkel et al., 2008, Fire ants dry and store insect pieces](https://pmc.ncbi.nlm.nih.gov/articles/PMC3127378/) documents stored dried prey and later larval feeding. It also distinguishes crop-carried liquid from solid prey transport.
- [Modeling temperature-mediated fluctuation in colony size in the fire ant, 2012](https://www.sciencedirect.com/science/article/abs/pii/S0022519312001282) describes drought survival through tunnels/chambers extending toward the water table. It does not validate the game's exact search rule or depth.
- [Monaenkova et al., 2015, Behavioral and mechanical determinants of collective subsurface nest excavation](https://pubmed.ncbi.nlm.nih.gov/25954041/) reports deepest construction at intermediate moisture and poor excavation at the dry/saturated extremes.
- [Internal distribution of liquid foods in isolated fire-ant workers, 1981](https://www.sciencedirect.com/science/article/pii/0022191081900342) studies worker size and crop retention. The two capacity formulas and displayed bars remain game tuning.
