# Rain & renewal model · v0.4

The aim is observable, testable biological behavior. The current colony is a harvester-inspired soil-nesting ant model with minor and major workers. It does not represent every ant species, a validated species-specific colony, or an individually simulated neural brain.

## Implemented mechanisms

- **Flexible work:** adult age, individual response thresholds, resource demand remembered from nest contact, and bounded skill improvements influence task choice. Urgent shortages can draw young workers into foraging. Majors usually guard but can collect resources. Weak work signals leave a resting/grooming reserve.
- **Local discovery and recruitment:** scouts sample nearby sources and follow food or water scent cues. Returning carriers reinforce the relevant trail. Antennal encounters with nearby returning workers can share a lower-confidence source memory. Memories expire and lose confidence after a failed visit; remote depletion is not automatically known.
- **Queen and brood care:** the queen walks slowly within sheltered chambers, favors suitable conditions, and pauses for a four-second laying animation. Each egg appears at her actual location. Nurses reserve individual brood items, walk to them, carry them in their jaws, and place them in nursery space. Attendants fetch food/water at the central store and feed a queen living elsewhere. Nurses travel to actual brood. Larvae need protein and lose nutrition over time. Care, nutrition, humidity, and temperature affect development; severe deprivation reduces vitality. Egg laying and development have independent player controls.
- **Excavation:** all underground earth is equally diggable; experience improves handling. There are no stone or harder layers, including at great depth. Demand for space triggers short, irregular branches and chambers. Candidate sites favor suitable moisture and separation from existing rooms. Soil is carried out as pellets and deposited around an open entrance.
- **Distinct materials:** contoured rooted topsoil has dark organic fragments above softer-looking granular earth. These are visual distinctions, not mechanical barriers. Mounds use a bare tan pellet texture with fragments of their excavated origin, never a grass cap.
- **Grass and rain:** seeded terrain generates grass clumps and low spots. Harvesting reduces visible grain; fully harvested clumps wither, wait, sprout, and produce grain again. Grass buried by a mound stays dead. Seeded intermittent storms add water to local depressions. Collection and evaporation reduce puddles.
- **Route recovery:** working ants track real movement, reroute after terrain changes, and abandon blocked jobs without losing or confusing cargo. Crowding slows movement without a hard collision deadlock. Rest and grooming remain bounded, purposeful behaviors.
- **Individual state:** age, energy, hydration, health, experience, source memory, traffic delays, and task reasoning persist. Soil removed must equal deposited soil, living ants' soil cargo, and explicitly abandoned soil.

## Deliberate abstractions

One colony day is ten simulation minutes at 1×. Baseline egg-to-adult development uses approximately 38 modeled days (8 egg, 19 larval, 11 pupal) before nutritional and environmental adjustments; initial brood starts at different stages so the first emergence can be observed sooner. The stage schedule follows a published comparative estimate used for Florida harvester ants, not a new measurement or validated species calibration. At the default laying setting, the target is 2–30 eggs per modeled day, rising with worker population and constrained by food, water, queen health, brood capacity, and the population ceiling. This laying curve is a conservative gameplay approximation, not an empirically fitted reproduction function. Player multipliers deliberately accelerate it. Lifespans, diet ratios, environmental responses, and movement remain tuning values. Time, distance, metabolic cost, and temperature are not yet physically calibrated to a shared scale.

Nest layout currently uses a colony-level space request and candidate plan. Workers execute it locally, reserve dig sites, and transport soil. Fully emergent architecture from local excavation/deposition rules, real soil collapse, water diffusion/flooding, a full food-sharing network between individual crops, disease, waste management, and reproductive flights are future work. Aggregate food/protein/water stores and a short sharing pause stand in for most social food transport; distant queen provisioning is carried explicitly. Rain runoff uses topographic basin detection and a bounded accumulation/evaporation model, not fluid dynamics. Grass dieback after seed depletion is the requested game lifecycle; removing ripe seed does not universally kill real grasses. Grass seeds supply an abstract energy/protein mix, rather than a complete calibrated diet.

The map generates material beyond the visible area and stores altered cells, but persistent region streaming and arbitrarily large colonies are not implemented. The optional 500-ant ceiling is a testing control, not a supported-device capacity promise.

Old saves preserve their original surface geometry and excavated cells. New colonies get seeded contours. Brood ages are rescaled during migration to preserve developmental progress. Weather, grass state, transport claims reconstructed from ant jobs, and carried brood survive saves.

## Research informing the direction

These sources support mechanisms and future calibration, not the exact game coefficients:

- [Robinson, Feinerman & Franks, 2009: Flexible task allocation and the organization of work in ants](https://pmc.ncbi.nlm.nih.gov/articles/PMC2817103/) — flexible task allocation, physiological thresholds, age, and interactions.
- [Empirical response-threshold study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6586672/) — variation between workers and colony task allocation.
- [Worker age and caste dynamics](https://pmc.ncbi.nlm.nih.gov/articles/PMC7039887/) — age-related behavior and worker differences, rather than fixed universal jobs.
- [Soil moisture and particle mechanics in excavation](https://pubmed.ncbi.nlm.nih.gov/25954041/) — substrate properties influence construction.
- [Pellet formation and soil transport](https://pubmed.ncbi.nlm.nih.gov/23457648/) — excavation and carrying material are distinct activities.
- [Moisture preferences in nest construction](https://pubmed.ncbi.nlm.nih.gov/24748382/) — environmental conditions influence where ants build.
- [Nest architecture and plasticity](https://pmc.ncbi.nlm.nih.gov/articles/PMC8630048/) — architecture changes with colony and environmental context.

- [Tschinkel: Sociometry and sociogenesis of reproduction in Florida harvester ants](https://pmc.ncbi.nlm.nih.gov/articles/PMC2990325/) — comparative developmental schedule; the source itself describes this as an estimate.
- [Targeted worker removal and brood transport specialization](https://pmc.ncbi.nlm.nih.gov/articles/PMC10901836/) — workers physically transport brood after identifying suitable locations. Species differ in how flexible this specialization is.
- [Sequential sand and seed transport in Florida harvester ants](https://pmc.ncbi.nlm.nih.gov/articles/PMC4624972/) — distinct transport activities between nest regions.

Next biological milestone: choose one reference species and calibrate its caste development, diet, worker-age task tendencies, brood conditions, communication, and measured construction rules. Keep explanations and regression checks tied to each added mechanism.
