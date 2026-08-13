# Biome procgen spike — harvest notes

Running log of what this spike proved, decided, and parked. The spike branch
(`spike/biome-scatter-grammar`) is reference material, never merged; a fresh implementation pass
re-builds the keepers properly against these notes.

## What the spike proved

- **Silhouette grammars carry biome identity with zero art assets.** Instanced box/primitive
  assemblies + palette + density read as distinct terrains from the isometric camera. Thin
  verticals need clustering or glow to survive map-scale zoom.
- **Three-layer model**: roads (edges) / places (nodes) / wilderness (scatter). Each layer has
  different placement rules. This framing came from Geoff and everything downstream clicked once
  adopted.
- **Clearance-aware placement**: scatter keeps out of node discs and edge corridors
  (point-to-segment distance against the 3×3 cell neighbourhood's Gabriel edges). Multi-part
  assemblies must clearance-check per part, not per anchor (toppled column trains taught this).
- **Node structures are their own system**: per-node archetype hash draw (plain / post ring /
  pylon pair / spire) — deliberate placement tied to the node, distinct from ambient scatter.
  Matches the worldmap doc's "node archetypes by low-probability hash". Visual archetypes must
  never correlate with sealed content (B-constraints apply to geometry exactly as to tint).
- **Cluster dispersion**: low-frequency value-noise density field (per-biome frequency + contrast
  exponent) × per-cell draws + min-separation + rare cluster-independent landmarks. Turned even
  sprinkle into composition — districts, voids, horizon points.
- **Debris ground layer**: high-count tiny shards/chips/stubs with a cluster-independent
  background term. Fixes "dead floor" everywhere; the environmental equivalent of grass.
- **Terrain relief**: 2-octave value-noise heightfield, biome-tuned amplitude, displacing a
  subdivided lit ground grid that the tint texture drapes over. Key idea: **terrain grades flat
  near roads and nodes** (smoothstep on distance to nearest lattice feature) — solves every
  structure/lattice interaction and reads as engineered causeways. The Quiet gets the largest
  amplitude: emptiness textured by landform instead of props.
- **Props seat on terrain** by sharing the height sampler (baseZ added at push time).
- **Scale taste**: props at ~55% of first-draft size, densities ~2×. Props are texture between
  nodes, never monuments competing with node spacing. Node structures ~75% (grander than ambient).
- **Emissive accents** (unlit bright instanced boxes) are the cheapest mood win. Glow through fog
  reads as "the machines are still on".

## Rendering lessons (bugs the real implementation must not repeat)

- **Atomic pan swaps**: ground geometry must derive in render (memo on seed+viewport), never be
  swapped inside an effect — an effect-time swap drapes the new area's texture over the old
  area's grid for a frame+ ("biomes stacked on biomes" while scrolling). Dispose old geometry
  only after unreference.
- **Elevation interactions**: fog plane vs terrain height vs floor plane vs flat lattice all
  couple. Spike answers: fog raised above max swell, floor dropped below max dip, ground grid at
  2 verts/cell minimum so the road-grade band resolves (1 vert/cell interpolates terrain across
  roads). Production should consider terrain-aware fog/lattice instead of constant juggling.
  Fog switched to a depth-independent veil (depthTest off, renderOrder last) to stop tall props
  poking through — evaluate which look design wants.

## World scale canon (Geoff, in-spike)

- **Node spacing is ~500m-1km.** One cell ≈ one settlement-to-settlement leg; one world unit
  (spacing/17.3) ≈ 30-60m. Consequences: props are arcology-scale ruin fragments (coherent with
  habitat fiction), ground texture at sub-cell scale means districts/blocks, never floor tiles,
  and any future texture detail must be sanity-checked against this scale. Nothing else in the
  spike had this written down — check every size against it in the production pass.

## Current biome parameter identities (placeholder roster biome_1..4)

| id | working name | grammar | cluster | relief |
|----|--------------|---------|---------|--------|
| 0 | Maintained | upright intact stacks, slate palette; road lights | mid freq, mild | near-flat (0.06) |
| 1 | Grown Works | thin antenna-trees, branch tiers, glow tips | groves | gentle (0.14) |
| 2 | The Quiet | almost nothing; rare half-buried wreck | sparse | biggest swells (0.4) |
| 3 | Ruinfall | tapered columns, lean, toppled trains, fallen giants | broad clumps | rough (0.2) |

## Performance model (measured in-spike)

- Per-frame rendering is a non-problem: the whole scatter system is two persistent instanced
  draws; 5k+ parts idle at 240fps with 5ms worst frames. Instancing scales to 100k+ parts.
- The cost is **rebuild spikes at chunk-crossing pans**, all main-thread: scatter build (~24ms
  measured), biome field texels, and relief grid. Spike fixes: persistent instanced meshes with
  capacity counts (no remount, no pipeline recompile), per-cell biome caches in the relief grid.
- Production scaling ladder, in order: (1) incremental chunk generation — build only
  newly-entered chunks, evict departed ones, never rebuild the whole viewport; (2) generation in
  the SharedWorker (already the architecture's home for map derivation) with transferable
  buffers; (3) LOD — debris and small props culled beyond a zoom threshold; (4) capacity-bounded
  persistent GPU resources (done in spike).
- **Rung 1 proved in-spike**: chunk-keyed LRU cache (ground tile geometry+texture+material and
  scatter part arrays per 16-cell chunk), misses built progressively 2 per animation frame,
  viewport scatter assembled by concatenating cached chunk arrays into persistent instanced
  buffers. Drag-pan benchmark (simulated pointer drags, ~25 chunks of travel): **409ms peak /
  16 dropped frames → 7ms / 0 dropped**; a 6-drag spiral storm peaks at 38ms with zero drops.
  The remaining rungs (worker, LOD) are optimization headroom, not necessity, at current content
  density.
- Chunk-cache gotcha: entries must be resolved per render against the mutable cache (the
  progressive builder ticks re-renders) — a memo keyed on viewport goes permanently stale and
  renders an empty world.
- Dev perf HUD (fps / worst frame / part counts / build ms) proved immediately necessary; a real
  version belongs in the dev tools panel. three's WebGPU renderer doesn't expose draw/triangle
  counts through `renderer.info.render` the WebGL way — needs its own counter source.
- **The 500ms hitch anatomy**: consecutive chunk crossings during a continuous pan/zoom each fired
  a full synchronous rebuild, doubled by dev StrictMode, stacking into half-second freezes.
  **`useDeferredValue` on the chunk-aligned viewport fixed it almost entirely** (500ms → 21ms peak
  frame gap, measured): rebuilds become interruptible transitions and stale intermediate viewports
  coalesce away. This belongs in the production implementation regardless of the worker move — it
  is one line per consumer and removes the freeze class outright. Residual worst-frame equals the
  longest single memo, which only the worker/incremental ladder removes.
- Timing instrumentation inside memos misreads under concurrent rendering (interrupted renders
  yield nonsense durations like 96s) — production metrics need effect-side timestamps instead.

## Art direction (decided in-spike)

- **Committed unnatural**: full procgen means naturalism ("green trees") always loses — the style
  is crusted dark dereliction (rust/navy/charcoal grounds and metals) with neon accents. Geoff's
  call; repainted in-spike and it lands immediately.
- **Per-biome neon signature**: maintained cyan, grown works acid green, quiet dim violet, ruin
  amber. Doubles as distance legibility — a biome is identifiable by its lights alone. Glow
  instances carry per-instance color.
- **Edge furniture layer** (Geoff's idea): roads carry biome-vocabulary structures along them —
  lit lamp pairs (maintained), gates missing their lintels (ruin), leaning tap-masts over the
  route (grown), lone waymarkers (quiet). Completes the three-layer model: places, journeys,
  wilderness all have vocabulary.
- Density push held 240fps trivially (~7k parts on screen, capacity for 90k). Budget is nowhere
  near a constraint; depth/fidelity can go much further.

## Round: canon landmarks, modifier identity, prefetch

- **Pillars of light shipped** (canon: "rare distance-scaled landmarks visible as pillars of
  light in the fog"): landmark sites project a slim beam in the biome accent, height scaling with
  hex distance from origin, rendered above the fog veil (depth-independent, renderOrder above
  fog) with a slow independent pulse — the one thing fog never hides. Immediate exploration draw:
  the horizon asks a question.
- **Modifier layer earned its first visual identity**: modifier != none renders as a blacked-out
  district — every glow suppressed, every surface dimmed ~45%. Whole patches of grid gone quiet;
  eerie against lit neighbours; proves the base-x-modifier combinatorics visually.
- **Predictive prefetch**: chunk box movement queues the strip one chunk beyond the leading edge
  into the progressive builder, so pans arrive on generated ground.

## Blackout-district legibility (debug story worth keeping)

- First treatment (darken ground + dim props) was invisible: darker-dark reads as nothing on an
  already-dark world under fog. **On a dark palette, difference must come from temperature, not
  brightness** — blackout ground now runs cold blue-grey against the warm rust world and reads
  instantly.
- Debug technique that settled it: flash the layer hot magenta for one render. Confirmed the data
  was everywhere (a third of some chunks) and only the color was failing. Cheap and decisive —
  recommended for any "is this layer even on?" question.
- Modifier patches render far larger than the nominal 18-cell patch size (adjacent modifier-
  positive Worley cells clump); coverage ~9% globally but very uneven. Patch size and roster
  weights are design levers, currently untuned.
- Watch-out: the Maintained biome's navy ground sits near the blackout tint family — differentiate
  before both ship, or cold-dead and cold-maintained will blur.

## Parked questions

- Biome identity/naming is #272's design pass; everything here is placeholder vocabulary.
- Fog vs revealed-content interplay: does structure glow beyond the frontier leak "earned sight"?
  (Current stance: geometry is public plane, so no security issue — purely a design-feel call.)
- Panel-line wear: deck-plate seam grid drawn CPU-side into the tile texture (darker line every
  two cells, one texel wide) — reads as built plating up close, dissolves at distance (free LOD).
  Structure-level panel wear still needs per-instance shader work; parked for production.
- Grove readability at distance: crown housings atop each machine-tree mast give clustered groves
  canopy mass; tip lights back up in frequency. Maintained ground moved off cold navy to neutral
  concrete so cold now unambiguously means dead (blackout).
- TSL surface detail tier proven viable through the narrow facade: world-anchored noise grime
  multiplying the tile tint (two octaves, ~0.86-1.06 range) kills the vector-fill flatness, and a
  shared `time`-driven sine pulse breathes all emissives. Each new shader op is one passthrough
  facade member — the type-OOM constraint never reopens. Panel lines/hard wear still unexplored.
- Sump / Verdant Decks grammars — need roster entries first.
- Heightfield vs gameplay: does relief ever affect traversal, or stay purely visual?
- Perf: spike rebuilds whole scatter per chunk-crossing pan on main thread; production wants
  chunked incremental builds (likely in the SharedWorker) and LOD (debris culled at far zoom).

## Cleanup-agent notes

- Everything in `biome-scatter.tsx`, `ground-relief.ts`, and the biome-ground relief variant is
  spike-grade: string-keyed caches, magic channel numbers (100/500/900/2000/3000 blocks), inline
  palettes, no tests. Re-implement, don't merge.
- Hash channels must move into the `HASH_CHANNEL` registry with proper names.
- `buildCoordHash`/`buildValueNoise` exports from worldmap-core were added ad hoc — decide the
  real public API.
- The fog toggle and scatter toggle dev-tools additions are keepable patterns (match dev-slice
  conventions; add tests).
- Spike signup OTP log in `run-signup.ts` must never merge.
