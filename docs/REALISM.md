# Living terrain · v0.6

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

Water and non-grass food are drawn as discrete portions, each representing up to two model units. Pickup removes exactly the carried quantity; empty sources have no resource squares. Collection, cargo transfer and consumption are distinct events. Nectar supplies energy; insect pieces supply mostly protein; seeds remain opportunistic mixed food. Aggregate reserve units stand in for the full larval processing, storage and trophallaxis network.

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

Mound deposition now checks both neighboring ground levels and a broader three-cell support span. Its search radius expands with soil volume, so accumulated pellets spread into a lower, asymmetric slope. An entrance protects a narrow mouth; it no longer permits an arbitrarily high adjacent wall. Internal mound galleries require an intact roof, lateral soil and spacing from other galleries, with a limited excavated share of the mound. An exposed old gallery is outdoor air, not a permanent sheltered chamber.

Passage candidates use curved centerlines with connected raster bridges; chambers use seeded rotated, lobed outlines. Navigation still uses a cell graph. The cutaway renderer resolves that graph at eight contour samples and sixteen texture pixels per cell, with continuous material shading, fine grains and pixel-stepped rounded boundaries. This increases visual contour detail; it is not a claim of granular soil mechanics or continuous collision physics.

When an older save contains an unstable mound or a wide near-surface breach, a one-time correction regrades its existing solid spoil. Some of the same spoil closes excess shallow openings around a retained narrow shaft. Remaining spoil forms a supported surface pile. Ant identities, brood, stores, elapsed time, soil totals and original excavation records survive. Surface occupants and occupants of filled cells move to valid nearby positions; carried brood stays with its carrier. Already stable mounds retain their layout. Geometry version 2 prevents repeated corrections on subsequent loads.

Regression coverage includes 1,500 deposition cycles across seeds with intermittent gallery digging, support/height checks, legacy repair, connected curved routes, contour chunk boundaries, mature 120-ant screenshots, close-up and portrait views. The 120-day Actions scenario now checks exterior slopes and gallery share as well as population and material accounting.
