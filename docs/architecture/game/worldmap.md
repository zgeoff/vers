# The world map

The world map is the graph of places an avatar travels to reach content. Every avatar owns a
distinct map, focused near its origin and opening into an unbounded expanse as distance grows. The
map is generated, never stored: the client derives its shape locally and the server derives what
each place holds, so an infinite world ships almost nothing over the wire and no two players share a
layout.

The map splits into shape and contents: geometry is public and client-computable, content is sealed
and server-only, and the two derive from disjoint inputs. Knowing the shape of the map therefore
reveals nothing about where its sealed reward concentrates. This is the map-layer statement of the
flatness the [entropy model](./game-entropy.md) prices: a client that can compute the whole map
still cannot compute which node hides a jackpot, so scanning the map for one returns nothing. (Biome
sets a public, per-biome reward mean, covered below; the sealed per-node residual it can never
predict.)

## Two planes

Every derived value belongs to one of two planes, split by who can compute it.

- **Geometry** — positions, edges, difficulty, and biome — is `f(userSeed, coord)`. `userSeed` is
  the avatar's own seed: per-avatar, so every map differs, but non-secret and safe to ship. The
  client derives the entire infinite map locally in the SharedWorker, so panning is instant and
  needs no round trip. Public here means non-secret, not shared — the shape leaks nothing worth
  hiding.
- **Content** — reward profile, encounter family, archetype — is `f(scopeSecret, userSeed, coord)`,
  a one-way derivation the server alone can run. `scopeSecret` is a per-avatar secret held
  server-side and never shipped. A revealed node discloses too little to derive its unrevealed
  neighbours, and the secret being per-avatar means one player's reveals crack no other player's
  map.

`scopeSecret` is the whole of the guarantee. Content folds in the same `userSeed` geometry uses, but
without the secret that shared input derives nothing. Map-shape knowledge is therefore worthless for
locating the sealed loot, and drops stay server-authoritative over a client-generated shell.

## Geometry generation

Geometry generates one chunk at a time from a stateless hash, so any region around a coordinate
computes without touching the rest — the requirement an infinite world imposes — and every value is
per-avatar.

Two coordinate spaces run through generation. A **chunk coordinate** `(chunkX, chunkY)` addresses a
fixed block of hex cells, the unit of generation. A **cell coordinate** `(cx, cy)` addresses a
single hex cell within the lattice and is a node's identity; `cellToChunk` maps a cell to the chunk
that owns it.

- **Seeding** — a stateless
  [PCG](https://www.pcg-random.org/)/[Squirrel](https://www.youtube.com/watch?v=LWFzPP8ZbdU)-style
  integer hash `hash(userSeed, chunkX, chunkY)` seeds each chunk. It computes a chunk's value
  straight from its coordinates without generating any neighbour first, so regions load in any
  order. Nothing is baked; nothing is read from disk.
- **Placement** — a hex grid carries one jittered node per cell. Every cell holds a node; visible
  sparseness is a rendering choice, not an absence. The design rejects probabilistic existence,
  which would reintroduce "does this id exist?" ambiguity and risk a fragmented graph.
- **Connectivity** — a distance-capped [Gabriel graph](https://en.wikipedia.org/wiki/Gabriel_graph).
  Both sides of a chunk border evaluate the same predicate from the same hash inputs, so borders
  agree with no stitching pass — the geometry already joins itself. Agreement needs a one-chunk
  halo: evaluating a border cell's edges reads the neighbouring chunk's nodes, so each side sees the
  same candidates. The rule connects two nodes when the open disk with the candidate edge as its
  diameter contains no other node, and the edge falls within the distance cap — a local,
  deterministic test both neighbours compute identically.
- **Difficulty** — `clamp(floor(hexDistance(cell, origin) / k), 0, 100)`. It is O(1), needs no
  traversal, and the server recomputes it from the coordinate alone.

The backbone never fragments. A Gabriel graph contains the
[Euclidean minimum spanning tree](https://en.wikipedia.org/wiki/Euclidean_minimum_spanning_tree),
the shortest set of edges that still links every node. That containment holds as long as the
distance cap stays above the maximum jittered cell spacing: every minimum-spanning-tree edge then
falls within the cap and survives it.

## Node identity

A node's id is its cell coordinate, `(cx, cy)`. The id is stable across regenerations and
referenceable from the database. It survives per-player topology because `userSeed` varies what a
cell contains and which edges leave it, never that the cell exists or what its id is. First-clear
grants are keyed on `(avatarID, nodeID)`.

A coordinate id makes the node server-recomputable, which a random per-node id cannot: the
coordinate feeds straight back into the derivation, so the server reconstructs any node for
verification without having stored it. Reachability is one such recomputation, and it is a server
invariant checked at replay rather than a client-side filter. An activity settles only for a node
reachable from the avatar's **cleared frontier** — the set of nodes whose first-clear has verified —
under that avatar's own topology, the same edges the generator derives from its `userSeed`. The
check runs after the clear that opened the node settles, so the frontier it reads is current
([offline reconcile](./offline-reconcile.md#settlement-in-order)). Client and server derive paths
from identical inputs, so they never disagree on which nodes are reachable.

## Reveal

Reveal is the projection of what a player has earned sight of; fog is the boundary between that and
what stays hidden. It costs nothing to maintain because it is derived, not stored. The revealed
region is `⋃ disc(position(N), REVEAL_RADIUS)` over the avatar's verified first-clear nodes `N`,
plus a small landmark grant table `(avatarID, landmarkID)`.

- There is no reveal event stream and no stored reveal state; the projection is idempotent by
  construction. Storage is O(nodes completed) — roughly path length — not O(area visible). A player
  deep in the map pays for completion rows on the order of their path length, not the enormous
  visible area, which recomputes on demand.
- The hex grid is itself the spatial index, because a node maps structurally to its cell. A viewport
  query interleaves a cell's x and y bits into one
  [Morton/z-order](https://en.wikipedia.org/wiki/Z-order_curve) number, which keeps nearby cells
  adjacent in sort order, so the box covers a handful of 1D ranges that a final filter clips to the
  exact rectangle. A per-chunk run-length reveal bitmask is a permitted cache over the projection;
  the completion table stays the source of truth.
- Reveal discloses only after the predecessor completion verifies, never on optimistic completion.
  Disclosure carries expected-value-flat descriptor metadata alone — never salt or drops — and the
  server caps its fan-out independent of node degree. A live reveal request for a specific node is
  served ahead of the bulk fan-out, keeping the online path responsive.

## Selection and the offline horizon

Reveal and selection are two boundaries at deliberately different widths. Reveal is wide: a player
sees content within `REVEAL_RADIUS`. Selection is narrow: a player travels only to completed nodes
and their immediate neighbours, one hop out (`SELECTION_RADIUS`). Sight running ahead of reach is
the intended exploration feel, not a leak — a bounded local horizon cannot compute the global-best
jackpot, which is the exploit fog exists to deny.

Enforcement is server-side, not the cache. Replay checks each activity's node against the avatar's
cleared frontier and rejects anything beyond it, so cached descriptors and offline movement — both
client-controlled — buy no reach that the settlement check would deny.
`REVEAL_RADIUS > SELECTION_RADIUS` is a cache and pacing bound on top of that check, not the
boundary itself.

Within that bound, the server returns descriptors for the whole revealed disc, which extends past
the selectable edge, and the client caches them. Offline, a player farms revealed nodes and pushes
selection outward into already-revealed cells, bounded by `REVEAL_RADIUS − SELECTION_RADIUS`. The
cached disc's rim is the honest client's stop; the server's frontier check is the real one.
Pre-disclosing content into that shell is safe only because the base is flat: all reward-magnitude
variance lives in sealed, server-minted entropy — the node's sealed content and the crafting salt
drawn online (see [entropy model](./game-entropy.md#sealed-pre-commit-salt)) — so peeking at a flat
base buys nothing. A player farms the known offline and ventures into fog online.

Traversal, not just farming, also extends offline. Clearing a node offline opens its neighbours for
selection before the server verifies the clear. The client derives this widened selectable set from
its durable offline outbox — the client-minted start and queued checkpoints a completed clear leaves
behind — so the opened neighbours survive an offline restart rather than resetting to the cleared
frontier. The widening only ever adds to selection; reveal stays gated on verification, so an
offline clear opens ground the player can already see without disclosing any new fog. The widening
is a convenience, never the boundary: the reachability check at replay still rejects a node beyond
the avatar's cleared frontier, so an unearned offline jump settles nothing once the device
reconnects.

## Content sealing and verification

Every `activities` row carries `secretRef`/`secretVersion`, so the verifier runs the descriptor
check on every stream's first pass. `service-keys` custodies the versioned roots in
`SCOPE_SECRET_ROOTS` and derives each avatar's scope secret from the referenced root, and
`descriptor(coord)` folds in the avatar's own stored `seed` column.

Regeneration beats storage for an infinite per-avatar map: `descriptor(coord)` is O(1) and stores
nothing. Tamper-resistance follows without extra machinery. Encounter derivation already recomputes
a node's enemies from server truth at activity start, and the verifier recomputes at replay, so a
claim that an easy node was secretly a jackpot is refuted by recomputation. Nothing is stored to
forge.

The activity's `Started` event snapshots `contentVersion` — a content-derivation hash, parallel to
`simVersion` — and a `secretRef`/`secretVersion` pair. No secret material enters the event log,
because an append-only replayable stream is the wrong home for a secret. The pair only names the
versioned root `service-keys` custodies, and rotation adds a new root version rather than rewriting
rows.

## Difficulty and distance

Difficulty plateaus at 100 while distance runs unbounded, so pure vertical scaling dies at the cap.
Horizontal variety carries the world past it: biome combinatorics from blended noise fields, node
archetypes selected by low-probability hash, rare distance-scaled landmarks visible as pillars of
light in the fog, and juice — deliberate investment layered onto an activity
([economy modes](../../game-design/economy-modes.md)) — as the post-cap reason to push deeper. Past
the cap, distance stops meaning bigger numbers and starts meaning which biome, how deep, and what
waits out there.

## Biome — the terrain plane

Biome is how the terrain looks, so it renders, so it belongs on the public geometry plane, visible
through fog like distant landscape. Its constraints keep it from becoming a predictor of sealed
reward magnitude.

Biome is a per-node property, and terrain renders as node territories: every point of ground wears
the biome of its nearest jittered node. A biome patch is the union of its nodes' territories,
borders weave between nodes, and no node ever sits on a border. A low-frequency noise field assigns
each node's biome; node jitter alone gives the drawn borders their organic wander.

- **Independent hash domain** — biome is a low-frequency
  [value](https://en.wikipedia.org/wiki/Value_noise)/[Worley](https://en.wikipedia.org/wiki/Worley_noise)
  field over position, in a hash domain independent of content. These are smooth noise functions of
  a coordinate that paint organic regional patches, Worley by distance to the nearest scattered seed
  point.
- **Zero reward covariance** — `Cov(biome, sealed_reward_residual) = 0`. The content derivation
  takes no biome input. Pure flavour means content genuinely ignores biome, not merely that no bonus
  is visible: a hidden dependence would turn biome into a public prior over hidden magnitude.
- **Public biome-uniform term only** — biome touches reward only through a pure function of the
  public biome id, constant across every node in the biome and computable by every client. Biome may
  set a mean, publicly; it never rides hidden per-node variance.
- **No hidden per-node reward** — the design forbids a hidden per-node reward that clusters by
  biome, and the ban carries a permanent code comment. Such a reward would make client-visible
  terrain a treasure map for sealed loot — the exact sniping fog prevents.
- **Reroll defeated by progression cost** — the seed-selection attack, rerolling `userSeed` or
  spinning throwaway avatars for a favourable layout, is defeated by progression cost rather than by
  expected-value neutrality. A rerolled character starts at level 1, and using a fished
  high-distance biome demands re-earning full progression, a cost that dwarfs any biome bonus. Biome
  bonuses may therefore be additive expected value — genuinely richer biomes — not merely flavour
  tilts. This holds only while reroll cost far exceeds biome payoff.
- **Earned by path-gating** — path-gated selection keeps a known-good biome earned: reaching and
  sustaining it is gated on the cleared frontier, so a rich biome is safe on the reward axis only
  because the path to it is.

## The reveal radius

`REVEAL_RADIUS` is the one knob that sets both the look-ahead bound and offline exploration depth.
It holds in the range of 2 to 5 hops, and never above 5: look-ahead value climbs with the radius and
the scanning exploit returns as it approaches infinity, so the cap is a security bound, not a
preference.

## Package layout

- **`@vers/worldmap-core`** — the platform-agnostic geometry generator, consumed as TypeScript
  source. It exposes `buildChunk` (a chunk's nodes), `collectNodeEdges`, `getBiome`, and
  `getDifficulty` (a cell's edges, biome, and difficulty), `toNodeID` (a cell's canonical id),
  `buildBiomeField` (a viewport's biome samples), and `collectRevealedCells` (the revealed cells for
  a set of sources and a viewport). Edges are computed, not stored; a node's `id` is its cell
  coordinate.
- **Server-only content module** — content derivation keyed by `scopeSecret`, never bundled to the
  client. Its functions (`deriveContent`, `buildEncounterTable`, `getRewardTier`) live here and
  nowhere the client can reach.
- **`@vers/worldmap-client`** — geometry generation for render, viewport-bounded reveal queries, and
  caching of disclosed content, in the SharedWorker. Geometry renders optimistically; content slots
  read as fogged until the server discloses them. The three.js render layer — meshes, edge lines,
  culling, tooltips — draws from the local generator.

## Glossary

| Term             | Meaning                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| geometry plane   | Everything `f(userSeed, coord)`: positions, edges, difficulty, biome — public and client-computable.                 |
| content plane    | Everything `f(scopeSecret, userSeed, coord)`: reward profile, encounter family, archetype — sealed, server-only.     |
| `userSeed`       | The avatar's own per-avatar seed; non-secret, shipped, and the shared input to both planes.                          |
| `scopeSecret`    | The per-avatar secret held server-side and never shipped; without it the shared `userSeed` derives no content.       |
| chunk coordinate | `(chunkX, chunkY)`, a fixed block of hex cells and the unit of generation.                                           |
| cell coordinate  | `(cx, cy)`, one hex cell; a node's stable id.                                                                        |
| cleared frontier | The set of nodes whose first-clear has verified; the boundary the reachability check reads.                          |
| reveal           | The derived projection of the region a player has earned sight of, a union of discs over verified first-clear nodes. |
| selection        | The narrower set a player may travel to: completed nodes and their immediate neighbours.                             |
| descriptor       | The expected-value-flat content metadata the server discloses for a revealed node — never salt or drops.             |
| landmark         | A rare, distance-scaled node granted into a table and visible as a pillar of light through fog.                      |
