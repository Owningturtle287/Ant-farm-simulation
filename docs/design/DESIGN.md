# Visual and interaction system · revision 1

## Direction

A quiet living cutaway: warm earth, deep plum tunnel shadows, sage vegetation, cream brood, and tiny rust-colored ants with readable silhouettes. Terraria informs the pixel craft and side-view composition; its sprites, interface, and branding are not reused. The surface and mound remain part of the same world as the deepest tunnels.

The checked-in concept artwork is displayed by the native shell, with inspection hotspots from `reference-world.json`. The palette below guides production assets and the native HUD. The image is an aspirational art target, not a claim of implemented gameplay, exact ant anatomy, or production-ready sprites. See [art provenance](ART_PROVENANCE.md).

## Palette tokens

| Token | Hex | Use |
| --- | --- | --- |
| ink | `#17151F` | HUD, tunnel interiors |
| panel | `#24212B` | Inspector and control surfaces |
| border | `#514353` | Quiet outlines |
| cream | `#F5E8CE` | Primary text, brood |
| muted | `#B8AFA8` | Secondary text |
| amber | `#E9B86A` | Selection, active controls, queen marker |
| sage | `#94B18B` | Vegetation, positive states |
| water | `#84BCCA` | Moisture, optional overlay |
| sky | `#B8CBC4` | Surface backdrop |
| soil-light | `#9A6852` | Upper soil |
| soil-mid | `#80513F` | Middle soil |
| soil-deep | `#593D38` | Deep soil |
| soil-edge | `#C18B65` | Lit excavation edges |
| ant-shadow | `#241B22` | Ant outline |
| ant-rust | `#B96942` | Worker bodies |
| ant-light | `#DEA16B` | Body highlights |

No mood is conveyed by color alone. Status uses text and shapes. HUD text stays high-contrast. Pixel world textures never sit directly behind small UI text without an opaque panel.

## Pixel system and assets

- Base world cell: 4 logical art pixels in the reference scene; production cell scale can be tuned independently of biological dimensions.
- Sprite art bounds at 1×: minor worker 16×10, major 22×14, queen 28×16, male 20×14. These are readability ratios, not precise species measurements.
- Three body segments, six legs, paired antennae. Major workers read through their broad head; queens through thorax and abdomen. Silhouette carries caste identity.
- Pixel clusters use stepped edges and restrained highlights; no blur, smooth gradient shading, or faux 3D bevels in world art.
- Nearest-neighbor texture sampling. Avoid rotating pixel sprites arbitrarily in final art; use authored directional frames or constrained orientation where possible.
- UI uses native scalable rounded typography; small pixel fonts are reserved for optional large decorative headings, never vital stats.
- Lighting changes through palette bands and localized highlights. Decorative glow must never imply a light source required by the simulation.

## Representative scene

Wide surface and low mound above a connected nest. One main entrance, a winding central passage, nursery, queen chamber, food area, and a small lower branch. Roots and stones create a sense of terrain. Fourteen static ant hotspots illustrate multiple roles; a reference total of 72 ants is sample colony metadata, not a count of the visible artwork. The inspector uses sample worker `C-027` by default. Counts and stats are marked as reference values.

## Landscape layout

Baseline compact layout: 844×390 points; also inspect 667×375 and 932×430. Safe-area insets are respected by controls; the world may extend behind them.

| Region | Contents | Behavior |
| --- | --- | --- |
| Upper left | Ant Farm title, species, Design Preview label | Low visual weight |
| Upper center | Sample colony count and brood count | Collapses on compact widths |
| Upper right | Information button | Opens scope/help sheet |
| Right | 224–250-point inspector | Compact stats on short phones; scrolls if necessary |
| Lower left | Inspect list, Trails, Nest, zoom buttons | All controls work in this milestone |
| World | Terrain and ant selection | Pan, pinch, tap; selected ant gets a ring |

Keep the majority of the world unobscured. Inspector can be closed and reopened from the ant list. On small screens, hide decorative text before shrinking touch targets. Dynamic Type may increase panel scrolling rather than reduce type below readable sizes.

## Gestures and selection

- Drag pans. Pinch zooms within bounded limits. Zoom buttons are an equivalent alternative.
- Tap selects the nearest visible sample ant within a forgiving screen-space radius. Production cluster ambiguity picker belongs to the interaction milestone.
- `Inspect` opens an accessible list with caste and current sample job.
- `Focus ant` recenters on the selected fixture; it does not claim to follow a moving agent.
- `Trails` toggles illustrative trail marks. Legend says this is a sample overlay.
- `Nest` restores the reference camera. Information explains that no simulation is running.

## Animation specification for later implementation

| Action | Starting art budget | Readability requirement |
| --- | --- | --- |
| Walk / climb | 6–8 frames, 10–12 fps | Feet track movement; no sliding |
| Turn / antenna check | 3–4 frames | Recognizable search or direction change |
| Dig | 6 frames | Mandibles contact soil; pellet appears after excavation |
| Carry | Walking frames + load variants | Load attached consistently; silhouette remains readable |
| Feed / brood tend / groom | 4–6 frames each | Clear action without exaggerated human expressions |
| Major defense | 4–6 frames | Broad head and stance readable at normal zoom |
| Queen idle / laying | 4–6 frames | Subtle, low-frequency motion |

Blend activity timing to prevent synchronized ants. Reduce Motion disables decorative pulses and particles while preserving necessary movement. Animation timings are art targets, not simulation clocks. No complete animation set is claimed in steps 1–2.

## Acceptance

The scene is readable at phone size; ants, brood, and terrain separate visually; all visible controls have useful behavior; sample values are labelled; all touch controls are at least 44 points; selection can be performed without precise tapping; both landscape orientations work; the native app launches in CI; hardware comfort remains explicitly unverified until tested.
