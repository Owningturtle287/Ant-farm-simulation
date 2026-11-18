# Little Colony behavior model · v0.16

The reference species is the red imported fire ant, **Solenopsis invicta**, using the **single-queen (monogyne)** social form. This is a mechanistic, research-informed game model. It is not a reconstruction of neurons, a fitted whole-colony biological model, or an exact ant brain.

## Reproduction and worker organization

The queen reproduces; the modeled workers are sterile females. Worker body size is continuous, assigned at emergence, and influenced by larval feeding. Small, medium, and large are descriptive UI categories, not fixed job assignments. Adults do not grow into a different caste. New small/medium/large workers use approximate 30–60 / 60–90 / 90–180 modeled-day lifespans; queens use a much longer range. Migrated adults retain their prior lifespan to avoid an abrupt conversion-related die-off.

Workers estimate food and water needs from crops observed nearby and food parcels within reach of their senses. Individual estimates retain recent observations. Separate food and water recruitment cues rise with returning-forager contact and fade independently. A finite pickup, nursing visit, or successful dig reinforces the task temporarily. An empty search or blocked dig reduces its priority. Age and size bias the choices without assigning occupations. Large workers can collect grain and water, excavate, provision the queen, or attend brood. There is no permanent soldier/patrol branch. Short alarm investigations end as the stimulus fades. Recruitable reserves and grooming/resting remain normal behavior.

The nominal warm, well-fed development schedule is 8 days as an egg, 10 as a larva, and 12 as a pupa. Temperature, moisture, care and larval nutrition alter it. The thermal curve loosely spans published warm/cool developmental differences; it is not a fitted physiological model. Larval feeding uses protein intake. Poor nutrition slows development and severe deprivation reduces vitality.

The queen has a baseline production drive. Workers acquire a cue by tending a late-stage larva and relay it during close contact with the queen. Its influence accumulates and fades between visits. Her own crop, health, nearby laying space and sustained alarm shape whether she lays or seeks a quieter site. The production rate and cue timescale are game parameters. The player multiplier and overall brood capacity still apply. The adult ceiling does not stop the colony maintaining replacement brood. Ready pupae wait when adult capacity is full—an explicit game limit, not natural fire-ant development.

## Perception, recognition and learning

Workers sample local signal concentrations and nearby resources. Short-distance body contact compares a familiar composite colony-odor template with the encountered ant's cues. Recognized contact can update that template, activate recruits, relay a recently acquired late-larval cue to the queen, and support physical provisioning. Recognition is not an ID comparison. The three-component odor vector and acceptance threshold are computational abstractions; the chemistry of recognition is more complex and not uniquely established by hydrocarbons alone.

Returning carriers lay fading trails. Antennae sample neighboring cells and gradients influence movement, with recent-cell avoidance and stochastic exploration. Contact activates resource search without transmitting a remote coordinate. A worker learns a grain or water location through discovery. Failed visits reduce reliability, impose a cooldown, and eventually remove the memory. Satiation dampens recruitment to prevent a self-sustaining hoarding loop.

Food, water, home, alarm, queen and brood are **functional signal channels**, not claims about six separate chemical compounds in this species. Strengths, evaporation, diffusion and thresholds are game units. Food/water colors distinguish destinations for observation; the known trail chemistry is not recreated molecule by molecule. Queen and brood cues fade if their sources disappear. Disturbing ground near workers prompts a bounded alarm response; a click in empty ground creates no worker alarm.

Recognized worker contacts can stimulate a trip without providing a remote source position or changing the crop. Crop contents still require physical pickups or, for the queen, a meal offered by an attendant. Learning is individual experience that changes future decisions during play. Workers use a shared navigation graph, and architecture and brood capacity still have colony-wide limits.

## Finite resources and nutrition

Grain and water are tracked in portions of up to two model units. Pickup removes exactly the carried quantity. Collection, cargo transfer and consumption are distinct events. Grain supplies modeled energy and protein. Food and protein counters now summarize physical parcels, crop contents and in-transit food; they are not remotely accessible stockpiles. Larval processing remains simplified.

Rain creates new water in topographic depressions. Plants produce a new crop of grain after a delay. Player-placed grain is finite. Resource ledgers account for environmental inputs, remaining stock, harvested amounts, evaporation, decay and burial. These ecological inputs are accelerated game rules, not a calibrated field food web.

Grass dieback after complete seed harvest is retained from the requested game design; seed removal does not universally kill real grasses. Regrowth and rain make the ecosystem renewable while each available portion remains finite.

## Nest construction

New colonies start in a sealed chamber. Workers choose a reachable roof face and open the first exit through excavation. They set aside the excavated pellets inside, then carry them out and build a mound near the mouth. The center of the future mound is not a protected open canyon. Used passages, remembered space pressure, builder experience and accumulated soil prompt worker construction proposals. A shared queue and reservations coordinate their execution.

Deposited soil can be excavated again to produce narrow interior mound galleries. Existing roofs remain visible as cutaway back walls. Peripheral exits and mound passages are procedurally selected and physically dug, not instant teleports. Nursery selection considers stage-specific moisture/temperature and crowding, with hysteresis to avoid endless brood shuttling. All ground remains soft and diggable as requested. Deposition rejects protected galleries and unreachable candidates; route searches include the existing mound roof and known nest extent. Foraging can continue through aboveground galleries when the mound surrounds an older mouth. Loaded workers can interrupt work to replenish energy and hydration without losing cargo or transported brood.

This is still a candidate-plan architecture model, not fully emergent stigmergy or granular soil physics. Worker proposals use some colony-level state as a shortcut. Geometry, distance and metabolic time are not physically calibrated together. Flooding, collapse and ventilation physics are not modeled.

For soil accounting, excavation of original earth increases `soilExcavated`. Re-excavating deposited soil moves it from `soilDeposited` into cargo without manufacturing new earth; `soilRehandled` records that work. Always preserve:

`soilExcavated = soilDeposited + living soil cargo + staged soil + soilAbandoned`

Existing colonies retain their original excavation records. Unstable older mounds and oversized shallow openings receive the soil-preserving correction described below. Their behavior and resource system upgrade in place, and old indefinite patrol jobs are released. Start a new colony for the fully revised founder nest. Developmental migration preserves both stage and within-stage progress.

## Research used

These sources support mechanisms and plausible ranges; none validates the exact coefficients above.

- [Tschinkel, 2011: The Organization of Foraging in the Fire Ant, Solenopsis invicta](https://pmc.ncbi.nlm.nih.gov/articles/PMC3391925/) — scouts, recruitable reserves, local activation from foraging tunnels, worker age and the underground foraging network.
- [Family before work: task reversion in S. invicta](https://www.nature.com/articles/s41598-023-29246-z) — brood-associated stimuli and task changes. This does not imply unlimited flexibility in every task or species.
- [Cassill & Tschinkel: Task selection by workers of the fire ant](https://digitalcommons.usf.edu/fac_publications/1000/) — worker task selection and the participation of large workers in food recruitment/storage.
- [Tschinkel, 1988. Social control of egg laying](https://doi.org/10.1111/j.1365-3032.1988.tb00484.x) — fourth-instar larvae stimulated queen oviposition in manipulation experiments, whereas worker numbers alone did not.
- [Tschinkel, 1995. Stimulation of queen fecundity by a highly specific brood stage](https://www.bio.fsu.edu/~tschink/publications/1995-6.pdf) — suggests that attending workers relay a cue from a narrow late-larval stage.
- [Aguilar et al., 2018. Collective clog control](https://crablab.gatech.edu/pages/publications/2018-Collective-clog.html) — uneven excavation effort and reversals near crowding informed the persistence and blocked-dig responses.
- [Gravish et al., 2013. Climbing, falling, and jamming](https://pubmed.ncbi.nlm.nih.gov/23690589/) — documents traction and contact during fire-ant locomotion in confined spaces. The surface step-over uses a simplified height above the ground plane, with separate collision checks for terrain and for bodies at the same height.
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

Food and water have separate displayed crop budgets, both increasing with body size. The food budget contains energy-bearing and protein components. These are functional game compartments, not a claim that a real ant has two independent crop organs. Body energy/hydration remain separate from held supplies. Ants consume their own contents, and antennal encounters can move a bounded amount between crops without manufacturing nutrients. Queen attendants and nurses must obtain and carry their food before feeding locally. A nurse with no spare crop volume can carry a solid food parcel from a cache to a larva in its mandibles, preventing a full carbohydrate crop from blocking protein feeding. In this simplified nutrient model, protein can provide metabolic energy when the carbohydrate component is empty; a protein-filled crop must not lock a worker into futile cache visits. Queen egg production consumes local nutrients. Nurses reserve individual care targets and weigh larval hunger, time since care and travel distance, reducing crowds that repeatedly select the same baby. Nutrient accounting includes collection, consumption and losses.

When body energy and the food crop are full, excess carried food is placed into individual dry nest spaces. Ants retrieve specific parcels when supplies are needed. Each parcel holds at most two game units; a partly consumed parcel shrinks and disappears when empty. Stored food is represented as grain. Documented fire-ant prey drying/storage supports solid insect caches; it does not establish that every type of liquid food is cached. Liquid water is never made into a nest cache. The header counts food energy plus protein and water held in crops.

Every resource portion and food parcel reserves one third-cell lattice slot. Every grounded egg, larva and pupa reserves a whole cell, excluding other items from that bed. A carried brood item reserves a destination while in transit; physical placement checks that the bed is still free. Abandoned claims are removed when colony demand is refreshed. There is no hidden stacking or visual suppression of multiple brood items at one bed. Adult movement and carried items are not rigid-body collision simulations. Free-bed and storage shortages encourage new excavation; normal play cannot conjure completed storage rooms.

Old virtual reserves are materialized once. Crowded older brood is separated while retaining IDs, stages, nutritional state and elapsed time. If an old inventory cannot fit, a one-time annex supplies migration space; the removed original earth is included in both excavation and removed-earth accounting. Existing food is retained as parcels. Old water first fills available crops; overflow is released outside, with unretained runoff explicitly counted rather than made into indoor storage. Outside portions unable to fit a legacy source's available space are counted as buried material. Modern saves preserve exact seeded continuation.

## v0.9 groundwater and drought

The default groundwater horizon is about 56 game cells below the reference surface, with independently seeded, smooth lateral contours. Rain/dry periods shift it slowly, and a player depth change moves gradually toward its target. The setting spans 24–240 cells. Distances are game units, not calibrated meters. Fully saturated openings are unsuitable for ant travel; the earth remains diggable, with no stone layer.

During prolonged drought or in groundwater-only mode, workers extend short descending probes from reachable excavation. Drinking requires both a cut into saturated soil and a reachable ledge immediately above it. An exposed column has a finite 48-unit reserve, up to two units at its seep, and a bounded release rate. A moving water table can close an old seep until workers extend the shaft. Rain recharges exposed columns even with surface puddles disabled. Turning surface water off drains existing surface pools and disables the placement tool. Surface rain and groundwater depth are independent controls.

Surface puddles evaporate during dry spells, with natural depressions determining space and capacity. Rain admits actual finite portions; water that cannot occupy a source is not silently stacked. Rain graphics use varying streaks, surface splashes, pool shimmer and localized ripples.

Research supporting the direction of this update:

- [Tschinkel et al., 2008, Fire ants dry and store insect pieces](https://pmc.ncbi.nlm.nih.gov/articles/PMC3127378/) documents stored dried prey and later larval feeding. It also distinguishes crop-carried liquid from solid prey transport.
- [Modeling temperature-mediated fluctuation in colony size in the fire ant, 2012](https://www.sciencedirect.com/science/article/abs/pii/S0022519312001282) describes drought survival through tunnels/chambers extending toward the water table. It does not validate the game's exact search rule or depth.
- [Monaenkova et al., 2015, Behavioral and mechanical determinants of collective subsurface nest excavation](https://pubmed.ncbi.nlm.nih.gov/25954041/) reports deepest construction at intermediate moisture and poor excavation at the dry/saturated extremes.
- [Internal distribution of liquid foods in isolated fire-ant workers, 1981](https://www.sciencedirect.com/science/article/pii/0022191081900342) studies worker size and crop retention. The two capacity formulas and displayed bars remain game tuning.


## v0.10: physical cutaway space

Adult body footprints exclude other adult bodies. Antennae and feet can make contact, and workers can walk over grain and brood. Workers approach from free adjacent positions, may yield or backtrack, and can initiate passing space in an underground bottleneck. This remains a simplified two-dimensional cutaway, not full three-dimensional insect biomechanics.

Nursery/cache placement leaves room-access lanes and avoids narrow shafts. Egg laying requires a clear bed beside the queen; when nearby beds fill she seeks another local position. Efficient egg removal lets her remain settled longer. A pupa emerges only if the actual new adult body fits beside attending workers. Brood silhouettes, brief molt crossfades and pale emergence effects are visual explanations of stage transitions, not a microscopic metamorphosis model.

Older compressed saves need a one-time spacing conversion. Adults and supplies are retained; if the existing dry terrain cannot hold those adults, a connected holding annex is added and its removed soil is explicitly recorded. Routine walking repairs route references rather than snapping bodies to a grid cell.


## v0.16 temperature

The player sets the temperature at the surface in Celsius. Soil cools with depth and the game profile approaches a six-degree difference at great depth. This models a warm surface over cooler ground in game units. Real soil temperatures also depend on time of day, weather and season and can temporarily be warmer at depth.

Exterior foraging is most active across a broad warm range and tails off below 22°C and above 36°C. The modeled field-foraging window spans 15–43°C. Workers walk more slowly outside the warm range. At brood temperature extremes, available warmer or cooler beds are compared with the current bed. Temperature also affects brood development and whether the queen can lay.

- [Porter & Tschinkel, 1987. Foraging in Solenopsis invicta](https://doi.org/10.1093/ee/16.3.802) — seasonal field measurements and the observed range of soil temperatures at which workers foraged.
- [Penick & Tschinkel, 2008. Thermoregulatory brood transport](https://penicklab.com/wp-content/uploads/2019/09/2008-Penick-Insectes-Sociaux-brood-thermo.pdf) — workers moved brood toward warm mound sections and deeper when the shallow area became hotter than preferred.
