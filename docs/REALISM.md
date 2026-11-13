# Living soil model · v0.3

The aim is observable, testable biological behavior. The current colony is a generalized soil-nesting ant model with minor and major workers, inspired by species with worker polymorphism. It does not represent every ant species, a validated species-specific colony, or an individually simulated neural brain.

## Implemented mechanisms

- **Flexible work:** adult age, individual response thresholds, resource demand remembered from nest contact, and bounded skill improvements influence task choice. Urgent shortages can draw young workers into foraging. Majors usually guard but can collect resources. Weak work signals leave a resting/grooming reserve.
- **Local discovery and recruitment:** scouts sample nearby sources and follow food or water scent cues. Returning carriers reinforce the relevant trail. Antennal encounters with nearby returning workers can share a lower-confidence source memory. Memories expire and lose confidence after a failed visit; remote depletion is not automatically known.
- **Brood care:** nurses travel to actual brood. Larvae need protein and lose nutrition over time. Care, nutrition, humidity, and temperature affect development; severe deprivation reduces vitality. Egg laying and development have independent player controls.
- **Excavation:** digging time depends on material, moisture, and experience. Rock blocks excavation. Demand for space triggers short, irregular branches and chambers. Candidate sites favor suitable moisture and separation from existing rooms. Soil is carried out as pellets and deposited around an open entrance.
- **Distinct materials:** topsoil has dark roots and organic fragments; sand has fine pale grains; clay has compact horizontal seams; stone has angular plates. Mounds use a bare tan pellet texture with fragments of their excavated origin, never a grass cap.
- **Individual state:** age, energy, hydration, health, experience, source memory, traffic delays, and task reasoning persist. Soil removed must equal deposited soil, living ants' soil cargo, and explicitly abandoned soil.

## Deliberate abstractions

One colony day is ten simulation minutes at 1×. Baseline egg-to-adult development uses 28 modeled days before nutritional and environmental adjustments; initial brood starts at different stages so the first emergence can be observed sooner. Development, laying, lifespan ranges, diet ratios, temperature response, humidity response, and movement are tuning values, not measurements of one named species. Time, distance, metabolic cost, and temperature are not yet physically calibrated to a shared scale.

Nest layout currently uses a colony-level space request and candidate plan. Workers execute it locally, reserve dig sites, and transport soil. Fully emergent architecture from local excavation/deposition rules, real soil collapse, water diffusion, a true crop-to-crop food network, brood relocation, disease, waste management, and reproductive flights are future work. Aggregate food/protein/water stores and a short sharing pause stand in for those social transport systems.

The map generates material beyond the visible area and stores altered cells, but persistent region streaming and arbitrarily large colonies are not implemented. The optional 500-ant ceiling is a testing control, not a supported-device capacity promise.

## Research informing the direction

These sources support mechanisms and future calibration, not the exact game coefficients:

- [Robinson, Feinerman & Franks, 2009: Flexible task allocation and the organization of work in ants](https://pmc.ncbi.nlm.nih.gov/articles/PMC2817103/) — flexible task allocation, physiological thresholds, age, and interactions.
- [Empirical response-threshold study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6586672/) — variation between workers and colony task allocation.
- [Worker age and caste dynamics](https://pmc.ncbi.nlm.nih.gov/articles/PMC7039887/) — age-related behavior and worker differences, rather than fixed universal jobs.
- [Soil moisture and particle mechanics in excavation](https://pubmed.ncbi.nlm.nih.gov/25954041/) — substrate properties influence construction.
- [Pellet formation and soil transport](https://pubmed.ncbi.nlm.nih.gov/23457648/) — excavation and carrying material are distinct activities.
- [Moisture preferences in nest construction](https://pubmed.ncbi.nlm.nih.gov/24748382/) — environmental conditions influence where ants build.
- [Nest architecture and plasticity](https://pmc.ncbi.nlm.nih.gov/articles/PMC8630048/) — architecture changes with colony and environmental context.

Next biological milestone: choose one reference species and calibrate its caste development, diet, worker-age task tendencies, brood conditions, communication, and measured construction rules. Keep explanations and regression checks tied to each added mechanism.
