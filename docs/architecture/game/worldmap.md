# The world map

The world map is the graph of places an avatar travels to reach content. Every avatar owns a
distinct map, focused near its origin and opening into an unbounded expanse as distance grows. The
map is generated, never stored: the client derives its shape locally and the server derives what
each place holds, so an infinite world ships almost nothing over the wire and no two players share a
layout.

Two properties hold together. Geometry is public and client-computable; content is sealed and
server-only; the two derive from disjoint inputs, so knowing the shape of the map reveals nothing
about where reward concentrates. This is the map-layer statement of the flatness the
[entropy model](./game-entropy.md) prices: a client that can compute the whole map still cannot
compute which node pays, so scanning the map for a jackpot returns nothing.

## Two planes

Every derived value belongs to one of two planes, split by who can compute it.

- **Geometry** — positions, edges, difficulty, and biome — is `f(userSeed, coord)`. `userSeed` is
  the avatar's own seed: per-avatar, so every map differs, but non-secret and safe to ship, so the
  client derives the entire infinite map locally in the SharedWorker — panning is instant and needs
  no round-trip. Public here means non-secret, not shared: shape leaks nothing worth hiding.
- **Content** — reward profile, encounter family, archetype — is `f(scopeSecret, userSeed, coord)`,
  a one-way derivation the server alone can run. `scopeSecret` is a per-avatar secret held
  server-side and never shipped. A revealed node discloses too little to derive its unrevealed
  neighbours, and the secret being per-avatar means one player's reveals crack no other player's map
  and colluders share no secret to triangulate.

`scopeSecret` is the whole of the guarantee: content folds in the same `userSeed` geometry uses, but
without the secret that shared input derives nothing, so map-shape knowledge is worthless for
locating loot. Drops stay server-authoritative over a client-generated shell.

## Geometry generation — chunked hex lattice

Geometry generates one chunk at a time from a stateless hash, so any region around a coordinate
computes without touching the rest — the requirement an infinite world imposes — and every value is
per-avatar.

Two coordinate spaces run through generation. A **chunk coordinate** `(chunkX, chunkY)` addresses a
fixed block of hex cells — the unit of generation. A **cell coordinate** `(cx, cy)` addresses a
single hex cell within the lattice and is a node's identity; `cellToChunk` maps a cell to the chunk
that owns it.

- **Seeding** — a stateless
  [PCG](https://www.pcg-random.org/)/[Squirrel](https://www.youtube.com/watch?v=LWFzPP8ZbdU)-style
  integer hash `hash(userSeed, chunkX, chunkY)` seeds each chunk: it computes a chunk's value
  straight from its coordinates without generating any neighbour first, so regions load in any
  order. Nothing is baked; nothing is read from disk.
- **Placement** — a hex grid carries one jittered node per cell. Every cell holds a node; visible
  sparseness is a rendering choice, not an absence. The design rejects probabilistic existence: it
  reintroduces "does this id exist?" ambiguity and risks a fragmented graph.
- **Connectivity** — a distance-capped [Gabriel graph](https://en.wikipedia.org/wiki/Gabriel_graph).
  Both sides of a chunk border evaluate the same predicate from the same hash inputs, so borders
  agree with no stitching pass — the geometry already joins itself. Agreement needs a one-chunk
  halo: evaluating a border cell's edges reads the neighbouring chunk's nodes, so each side sees the
  same candidates. A Gabriel graph contains the
  [Euclidean minimum spanning tree](https://en.wikipedia.org/wiki/Euclidean_minimum_spanning_tree) —
  the shortest set of edges that still links every node — so the backbone never fragments, but only
  while the distance cap stays above the maximum jittered cell spacing, so every MST edge falls
  within the cap and survives it. The rule connects two nodes when nothing sits between them and
  they fall within the cap — a local, deterministic test both neighbours compute identically.
- **Difficulty** — `clamp(floor(hexDistance(cell, origin) / k), 0, 100)`. It is O(1), needs no
  traversal, and the server recomputes it from the coordinate alone.

## Node identity — canonical cell coordinate

A node's id is its cell coordinate, `(cx, cy)`. The id is stable across regenerations, referenceable
from the database, and survives per-player topology because `userSeed` varies what a cell contains
and which edges leave it, never that the cell exists or what its id is. First-clear grants key on
`(avatarId, nodeId)` directly.

Coordinates make the node server-recomputable, which random per-node ids cannot: a coordinate feeds
straight back into the derivation, so the server reconstructs any node for verification without
having stored it. Reachability is a server invariant at activity start — an activity seed mints only
for a node reachable from the avatar's verified first-clear frontier under that avatar's own
topology, the same edges the generator derives from its `userSeed`, recomputed server-side — not a
client-side filter. Client and server derive paths from identical inputs, so they never disagree on
which nodes are reachable.

## Reveal — a projection, not stored state

Fog is the boundary between what a player has earned sight of and what stays hidden, and it costs
nothing to maintain because it is derived, not stored. The revealed region is
`⋃ disc(position(N), REVEAL_RADIUS)` over the avatar's completed nodes `N`, plus a small landmark
grant table `(avatarId, landmarkId)`.

- There is no reveal event stream and no stored reveal state; the projection is idempotent by
  construction. Storage is O(nodes completed) — roughly path length — not O(area visible), so a
  player a million nodes deep pays for a few thousand completion rows while the enormous visible
  region recomputes on demand.
- The hex grid is itself the spatial index, because a node maps structurally to its cell. A viewport
  query is a [Morton/z-order](https://en.wikipedia.org/wiki/Z-order_curve) range scan over packed
  coordinates — interleaving a cell's x and y bits into one number keeps nearby cells adjacent in
  sort order, so a 2D box reads as one 1D range. A per-chunk run-length reveal bitmask may cache the
  result, but the completion table stays the source of truth.
- Reveal discloses only after the predecessor completion verifies, never on optimistic completion.
  Disclosure carries expected-value-flat descriptor metadata alone — never salt or drops — and the
  server caps its fan-out independent of node degree. An on-demand priority bump keeps the online
  path responsive.

## Selection and the offline horizon

Reveal and selection are two boundaries at deliberately different widths. Reveal is wide: a player
sees content within `REVEAL_RADIUS`. Selection is narrow: a player travels only to completed nodes
and their immediate neighbours. Sight running ahead of reach is the intended exploration feel, not a
leak — a bounded local horizon cannot compute the global-best jackpot, which is the exploit fog
exists to deny.

Enforcement is server-side, not the cache. Replay is the authoritative reachability gate: on a
world-map-node run's first verified pass it checks the run's scope against the avatar's verified
first-clear frontier and rejects — voiding every dependent that borrowed from it — anything beyond
it, so cached descriptors and offline movement, both client-controlled, buy no reach replay would
deny. An online start also checks the target against the frontier, fast-rejecting where the frontier
is already current; an offline-reconciled root skips that admission check, since a predecessor's
clear may not yet be verified when the successor's root is ingested, and is adjudicated at replay
instead, ordered so the predecessor verifies first. `REVEAL_RADIUS > SELECTION_RADIUS` is a cache
and pacing bound on top of that check, not the boundary itself.

Within it, the server returns descriptors for the whole revealed disc, which extends past the
selectable frontier, and the client caches them. Offline, a player farms revealed nodes and pushes
selection outward into already-revealed cells, bounded by `REVEAL_RADIUS − SELECTION_RADIUS`, with
the cached disc's rim as the honest client's stop; the server's frontier check is the real one.
Pre-disclosing content into that shell is safe only because the base is flat — a flat base means
peeking buys nothing, since all reward magnitude lives in juice salt minted per-run and online. A
player farms the known offline and ventures into fog online.

Traversal, not just farming, also extends offline: clearing a node offline opens its neighbours for
selection before the server verifies the clear. The client derives this widened selectable set from
its durable offline outbox — the client-minted root and queued checkpoints a completed clear leaves
behind — so the opened neighbours survive an offline restart rather than resetting to the
last-verified frontier. The widened set only ever adds to selection; reveal stays gated on
verification, so an offline clear opens ground the player can already see without disclosing any new
fog. The client-side widening is a convenience, never the boundary: replay's own frontier check
still rejects and voids anything beyond the avatar's verified first-clear frontier, so an unearned
offline jump settles nothing it cannot back up once the device reconnects and replay adjudicates it.

## Content sealing & verification

Every `activities` row carries `secretRef`/`secretVersion`, so the verifier runs the descriptor
check on every stream's first pass; `service-keys` custodies the versioned roots in
`SCOPE_SECRET_ROOTS` and derives each avatar's scope secret from the referenced root, and
`descriptor(coord)` folds in the avatar's own stored `seed` column.

Regeneration beats storage for an infinite per-avatar map: `descriptor(coord)` is O(1) and stores
nothing. Tamper-resistance follows without extra machinery — encounter derivation already recomputes
a node's enemies from server truth at activity start, and the verifier recomputes at replay, so a
claim that an easy node was secretly a jackpot is refuted by recomputation. Nothing is stored to
forge.

The activity's `Started` event snapshots `contentVersion` (a content-derivation hash, parallel to
`simVersion`) and a `secretRef`/`secretVersion` pair. No secret material enters the event log — an
append-only replayable stream is the wrong home for a secret — the pair only names the versioned
root `service-keys` custodies, and rotation adds a new root version rather than rewriting rows.

## Difficulty plateau, infinite distance

Difficulty plateaus at 100 while distance runs unbounded, so pure vertical scaling dies at the cap.
Horizontal variety carries the world past it: biome combinatorics from blended noise fields, node
archetypes selected by low-probability hash, rare distance-scaled landmarks visible as pillars of
light in the fog, and juice overlays as the post-cap reason to push deeper. Past the cap, distance
stops meaning bigger numbers and starts meaning which biome, how deep, and what waits out there.

## Biome — the terrain plane

Biome is how the terrain looks, so it renders, so it belongs on the public geometry plane, visible
through fog like distant landscape. Its constraints keep it from becoming a predictor of sealed
reward magnitude.

Biome is a per-node property, and terrain renders as node territories: every point of ground wears
the biome of its nearest jittered node, so a biome patch is the union of its nodes' territories,
borders weave between nodes, and no node ever sits on a border. The low-frequency noise field below
assigns each node's biome; node jitter alone gives the drawn borders their organic wander.

- **Independent hash domain** — biome is a low-frequency
  [value](https://en.wikipedia.org/wiki/Value_noise)/[Worley](https://en.wikipedia.org/wiki/Worley_noise)
  field over position — smooth noise functions of a coordinate that paint organic regional patches,
  Worley by distance to the nearest scattered seed point — in a hash domain independent of content.
- **Zero reward covariance** — `Cov(biome, sealed_reward_residual) = 0`. The content derivation
  takes no biome input. Pure flavour means content genuinely ignores biome, not merely that no bonus
  is visible — a hidden dependence turns biome into a public prior over hidden magnitude.
- **Public biome-uniform term only** — biome touches reward only through a pure function of the
  public biome id, constant across every node in the biome, computable by every client. Biome may
  set a mean, publicly; it never rides hidden per-node variance.
- **No hidden per-node reward** — the design forbids a hidden per-node reward that clusters by
  biome, and the ban carries a permanent code comment. It would make client-visible terrain a
  treasure map for sealed loot — the exact sniping fog prevents — and it is the cheapest form to
  build, so it tempts.
- **Reroll defeated by progression cost** — the seed-selection attack (rerolling `userSeed` or
  spinning throwaway avatars for a favourable layout) is defeated by progression cost, not
  expected-value neutrality: a rerolled character starts at level 1, and using a fished
  high-distance biome demands re-earning full progression, a cost that dwarfs any biome bonus. Biome
  bonuses may therefore be additive expected value — genuinely richer biomes — not merely flavour
  tilts. This holds only while reroll cost far exceeds biome payoff; it is revisited if progression
  ever gets cheap or biome bonuses grow large relative to level investment.
- **Earned by path-gating** — path-gated selection keeps a known-good biome earned: reaching and
  sustaining it is gated on the completed frontier, so a rich biome is safe on the reward axis only
  because the path to it is.

## The reveal radius

`REVEAL_RADIUS` is the one knob that sets both the look-ahead bound and offline exploration depth.
It holds in the range of 2 to 5 hops, and never above 5: look-ahead value climbs with the radius and
the scanning exploit returns as it approaches infinity, so the cap is a security bound, not a
preference.

## Package layout

- **`@vers/worldmap-core`** — the platform-agnostic geometry generator, consumed as TypeScript
  source. Its public functions are `buildChunk(userSeed, chunkX, chunkY) → WorldMapNode[]`,
  `collectNodeEdges(userSeed, cx, cy) → WorldEdge[]`, `toNodeID(cx, cy) → CanonicalID`,
  `getBiome(userSeed, cx, cy) → BiomeSample`,
  `buildBiomeField(userSeed, viewport, options) → BiomeField`, `getDifficulty(cx, cy) → number`, and
  `collectRevealedCells(sources, viewport) → RevealedCells`. `buildChunk` takes chunk coordinates,
  `collectRevealedCells` takes reveal sources and a viewport, and `buildBiomeField` takes a viewport
  and sampling options; the rest take cell coordinates. Edges are computed, not stored; `id` is the
  canonical cell coordinate.
- **Server-only content module** — content derivation keyed by `scopeSecret`, never bundled to the
  client. Its functions (`deriveContent`, `buildEncounterTable`, `getRewardTier`) live here and
  nowhere the client can reach.
- **`@vers/worldmap-client`** — geometry generation for render, viewport-bounded reveal queries, and
  caching of disclosed content, in the SharedWorker. Geometry renders optimistically; content slots
  read as fogged until the server discloses them. The three.js render layer — meshes, edge lines,
  culling, tooltips — draws from the local generator.
