# The world map

The world map is the graph of places an avatar travels to reach content. Every avatar walks a
different map, dense near its origin and opening into unbounded space as distance grows. No server
stores any of it. The client computes the map's shape on the device, the server computes what each
place holds, and an infinite world therefore ships almost nothing over the wire.

One split governs everything else: the map's **shape** is public and any client can compute it,
while a node's **contents** are sealed and only the server can compute them. The two derive from
different inputs, so knowing the whole shape tells a player nothing about where the reward sits. A
client can generate the entire map and still not find which node hides a jackpot. Scanning for one
returns nothing, which is what makes an infinite client-generated world safe to ship.

This page covers the map: how its shape is generated, what a player may see, where a player may
travel, and how a node's contents stay sealed. [Game entropy](./game-entropy.md) prices why those
rules hold. [Seed chain](./seed-chain.md) covers what happens once an avatar starts playing a node.

## The two planes

Every derived value sits on one of two planes, split by who can compute it.

| Plane    | Derived from                      | Holds                                       | Who computes it  |
| -------- | --------------------------------- | ------------------------------------------- | ---------------- |
| geometry | `userSeed` and the coordinate     | positions, edges, difficulty, biome         | anyone           |
| content  | the scope secret, plus both above | the node's sealed reward and encounter pool | the server alone |

`userSeed` is the avatar's own seed. It differs per avatar, so every map differs, and it is not a
secret — shipping it leaks nothing, because the shape it produces is worth nothing on its own. The
client derives the whole infinite map from it locally in the SharedWorker, so panning never waits on
a round trip.

The scope secret is what seals the content plane. It is per-avatar, held server-side, and never
shipped. Content folds in the same `userSeed` geometry uses, but without the secret that shared
input derives nothing. One player's revealed nodes therefore crack no other player's map, and a
revealed node discloses too little to derive its unrevealed neighbours.

## Generating the shape

The generator works one chunk at a time from a stateless hash, so a region around any coordinate
computes without touching the rest — the thing an infinite world demands.

Two coordinate spaces run through it. A **chunk coordinate** addresses a fixed square of hex cells
and is the unit the generator works in; `CHUNK_SIZE` sets its side. A **cell coordinate** addresses
one hex cell and is a node's identity. `toChunkCoord` maps a cell to the chunk that owns it.

- **Seeding.** A stateless Squirrel3-style integer hash over the avatar's seed and a cell's
  coordinate seeds every draw. It computes a cell's values straight from its coordinates without
  generating a neighbour first, so regions load in any order and nothing is read from disk.
  Independent decisions read separate channels of that hash, so a node's jitter never correlates
  with its biome.
- **Placement.** Every hex cell carries exactly one node, offset from its centre by a bounded
  jitter. The jitter bound keeps a node inside its own hex, so a node never strays into a
  neighbour's cell. Sparse-looking ground is a rendering choice, not an absent node — the design
  refuses probabilistic existence, which would bring back the question of whether a given id exists
  and risk splitting the graph.
- **Connectivity.** Two nodes connect when they sit within `EDGE_DISTANCE_CAP` of each other and no
  third node falls inside the circle drawn on that pair as its diameter. That is a distance-capped
  [Gabriel graph](https://en.wikipedia.org/wiki/Gabriel_graph), and it is a purely local test. Both
  sides of a chunk border run it on the same inputs and reach the same answer, so borders join with
  no stitching pass. Agreement needs a halo: deriving a border cell's edges reads two rings of
  surrounding cells, far enough that no witness inside a candidate's circle can be missed.
- **Difficulty.** A cell's difficulty climbs one step every `DIFFICULTY_STEP` rings out from the
  origin, clamped at `MAX_DIFFICULTY`. It costs one hex-distance calculation, needs no traversal,
  and the server recomputes it from the coordinate alone.

The graph never splits into islands. A Gabriel graph always contains the
[Euclidean minimum spanning tree](https://en.wikipedia.org/wiki/Euclidean_minimum_spanning_tree) —
the shortest set of edges that still links every node — so every node stays reachable from every
other. That containment holds while the distance cap stays above the widest a jittered neighbouring
pair can stretch, which is what sets the cap's value.

## A node's identity

A node's id is its cell coordinate. The id survives regeneration and the database can reference it,
because `userSeed` varies what a cell contains and which edges leave it, never whether the cell
exists or what it is called. First-clear grants key on the avatar and the node id together.

A coordinate id is what makes a node server-recomputable, which a randomly minted id could never be:
the coordinate feeds straight back into the derivation, so the server reconstructs any node for
verification without having stored it.

Spatial queries pack a cell's two axes into one
[Morton](https://en.wikipedia.org/wiki/Z-order_curve) number by interleaving their bits, which keeps
nearby cells adjacent in sort order. A viewport box then covers a handful of one-dimensional ranges
that a final filter clips to the exact rectangle. That packing bounds how far from the origin a cell
can be addressed, and a cell outside that bound is refused rather than wrapped.

## What a player may see

Reveal is wide and derived. The server projects the revealed region as one hex disc of
`REVEAL_RADIUS` around every node the avatar has cleared and had verified, plus one around the
origin so a new avatar sees its starting ground rather than a fogged screen. A node is revealed when
it falls inside any of those discs.

Nothing stores that projection. There is no reveal event stream and no reveal state, so the
projection is idempotent by construction and storage grows with the nodes an avatar has completed —
roughly its path length — never with the area it can see. A player deep in the map pays for their
path, not for the enormous visible region, which recomputes on demand. A per-chunk run-length
bitmask is a permitted cache over the projection; the completion rows stay the truth.

The server discloses a node only after the clear that opened it verifies, never on an optimistic
one. It discloses the node's difficulty and its sealed content fields — never the secret those
fields derive from — and it caps how many nodes one clear can fan out to, whatever that node's
degree. A request for one specific node is served ahead of the bulk fan-out, so the online path
stays responsive.

A reveal request names specific nodes, and the server authorizes each against its own projection
rather than trusting the list. A node the projection does not cover discloses nothing and mints no
seed chain. The server drops that node from the response instead of refusing the whole request, so
one unauthorized coordinate costs a client nothing beside it. An honest client never names a refused
node, because client and server project from the same verified first-clear set, and
`vers.activity.reveal_refusals` counts every refusal.

## Where a player may travel

Selection is narrow, and it uses a different rule from reveal. A node is selectable when it is the
origin, when the avatar has already cleared it, or when an edge joins it to a node the avatar has
cleared. Reveal measures hex distance; selection follows edges. A revealed node two hops away with
no edge to a cleared node is visible and unreachable, and that is the intended shape of the boundary
rather than an accident of two radii.

The server, not the cache, holds that boundary. Replay checks each activity's node against the
avatar's **cleared frontier** — the set of nodes whose first clear has verified — and rejects
anything beyond it. Cached node data and offline movement are both client-controlled, so neither
buys any reach the settlement check would deny. The check runs after the clear that opened a node
has settled, so the frontier it reads is current
([offline reconcile](./offline-reconcile.md#settlement-in-order)). Client and server derive edges
from identical inputs, so they never disagree about which nodes connect.

Sight running ahead of reach is the intended exploration feel, not a leak. A bounded local horizon
cannot compute the globally best jackpot, which is the exploit fog exists to deny.

### Playing past the frontier offline

The server discloses the whole revealed region, which extends past what the avatar can travel to,
and the client caches it. Offline, a player farms the nodes they can already see and pushes outward
into ground the fog has already lifted from. The rim of the cached region is where an honest client
stops; the server's frontier check is the real boundary.

Disclosing content into that band is safe only because what it discloses is flat. Every bit of
reward-magnitude variance lives in sealed entropy the client cannot compute — the node's sealed
content, and the crafting salt drawn online
([entropy model](./game-entropy.md#sealed-pre-commit-salt)) — so reading a flat base early buys
nothing. A player farms the known offline and ventures into fog online.

Travel extends offline too. Clearing a node offline opens its neighbours for selection before the
server verifies the clear. The client widens its selectable set from the durable outbox that a
completed offline clear leaves behind, so the opened neighbours survive a restart rather than
snapping back to the verified frontier. That widening only ever adds to selection. Reveal stays
gated on verification, so an offline clear opens ground the player can already see and lifts no new
fog. It is a convenience and never the boundary: replay still rejects a node past the avatar's
cleared frontier, so an unearned offline jump settles nothing once the device reconnects.

## Sealing a node's contents

A node's contents derive from a **sealed descriptor**: an HMAC-SHA256 digest keyed by the avatar's
scope secret over a frozen encoding of the coordinate and `userSeed`. A golden test pins that byte
layout. The digest is uncorrelated with everything on the geometry plane, and no client can
reproduce it without the secret.

The content derivation reads that digest and nothing else from the map. It takes no distance, no
node degree, no region shape, and no biome, so no client-visible channel can predict what a node
holds. Each content version registers its own pool list, and the digest picks from it uniformly
without consuming any simulation randomness.

Recomputing beats storing for an infinite per-avatar map. The content derivation is constant-time
and stores nothing, and tamper-resistance follows without extra machinery: the server derives a
node's enemies afresh when an activity starts, and the verifier derives them again at replay, so a
claim that an easy node was secretly a jackpot is refuted by recomputation. There is nothing stored
to forge.

Every activity row carries a scope-secret reference and version, and the verifier re-derives the
node's difficulty and sealed fields on each stream's first pass and rejects a mismatch. The
activity's `Started` checkpoint carries that reference and version alongside `contentVersion`, a
hash of the content derivation. No secret material ever enters the checkpoint stream, because an
append-only replayable stream is the wrong home for a secret. The pair names only the versioned root
`service-keys` custodies in `SCOPE_SECRET_ROOTS`, and rotating a secret adds a root version rather
than rewriting rows.

## Biome, the terrain plane

Biome is how the ground looks, so it renders, so it sits on the public geometry plane — visible
through fog like distant landscape. Its constraints are what stop it from becoming a map to sealed
reward.

The terrain samples in two independent layers. A base layer paints organic regional patches from a
low-frequency hybrid of [Worley](https://en.wikipedia.org/wiki/Worley_noise) and
[value noise](https://en.wikipedia.org/wiki/Value_noise), with each biome's rarity banded by
distance from the origin. A second layer paints a rarer modifier over the top, spanning several base
patches, so a modifier reads as a broad variation rather than a patch of its own. Both sample at any
real position, not only at cell centres, so a renderer can fill a texel grid between nodes.

Terrain draws as node territories. Every point of ground wears the biome of its nearest jittered
node, a patch is the union of its nodes' territories, and borders weave between nodes so no node
ever sits on one. Node jitter alone gives those borders their organic wander, and a tint crossfade
softens the border where two territories wear different biomes.

Four rules keep biome flavour rather than information:

- **The content derivation takes no biome input.** Formally, biome and the sealed reward have zero
  covariance. Content genuinely ignores biome — not merely that no bonus is visible, since a hidden
  dependence would turn biome into a public prior over hidden magnitude.
- **Biome touches reward only through a public function of the public biome id.** That term is
  constant across every node the id covers and every client can compute it. Biome may set a mean,
  publicly. It never rides hidden per-node variance.
- **A hidden per-node reward that clusters by biome is permanently forbidden,** and the ban carries
  a code comment saying so. Such a reward would make client-visible terrain a treasure map for
  sealed loot, which is the sniping fog exists to prevent.
- **Progression cost defeats seed-fishing.** Rerolling `userSeed` or spinning up throwaway avatars
  for a good layout is beaten by what a reroll costs, not by keeping biomes equal in value. A
  rerolled character starts at level 1, and using a fished high-distance biome demands re-earning
  full progression — a cost that dwarfs any biome bonus. Biome bonuses may therefore be genuinely
  richer rather than flavour tilts, and that holds only while reroll cost far exceeds biome payoff.

Path-gating is what keeps a good biome earned. Reaching one and staying there is gated on the
cleared frontier, so a rich biome is safe on the reward axis only because the path to it is.

## Difficulty past the plateau

Difficulty stops climbing at `MAX_DIFFICULTY` while distance runs on, so scaling numbers alone runs
out. Horizontal variety carries the world past that point:

- biome combinatorics from the two blended noise layers
- node archetypes picked by a low-probability hash
- rare distance-scaled landmarks, visible as pillars of light through the fog
- juice, the deliberate investment a player layers onto an activity
  ([economy modes](../../game-design/economy-modes.md))

Past the plateau, distance stops meaning bigger numbers and starts meaning which biome, how deep,
and what waits out there.

## The reveal radius

`REVEAL_RADIUS` sets both how far a player sees ahead and how deep they can explore offline, which
makes it the one knob worth arguing about. It holds between 2 and 5 hops and never higher.
Look-ahead value and the map-scanning exploit's return both climb with the radius, so the upper
bound is a security limit rather than a matter of taste.

## Package layout

Three packages split along the same line the two planes do.

- **`@vers/worldmap-core`** — every geometry derivation both sides run, consumed as TypeScript
  source and safe to bundle. Its `index.ts` names them. Edges are computed, never stored, and a
  node's id is its cell coordinate.
- **`@vers/worldmap-content`** — the sealed derivations, keyed by the scope secret and never bundled
  to the client. It also reads an avatar's scope secret from `service-keys`.
- **`@vers/worldmap-client`** — geometry for render, viewport-bounded reveal queries, and caching of
  disclosed content, all in the SharedWorker. Geometry renders optimistically while content slots
  read as fogged until the server discloses them. The three.js layer — meshes, edge lines, culling,
  tooltips — draws from the local generator.

## Glossary

| Term              | Meaning                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| geometry plane    | Everything derived from `userSeed` and a coordinate: positions, edges, difficulty, biome. Public and client-computable.  |
| content plane     | Everything that also needs the scope secret: a node's sealed reward and encounter pool. Server-only.                     |
| `userSeed`        | The avatar's own seed. Not a secret, shipped to the client, and an input to both planes.                                 |
| scope secret      | The per-avatar secret the server holds and never ships; without it `userSeed` derives no content.                        |
| chunk coordinate  | The address of one square of hex cells, and the unit the generator works in.                                             |
| cell coordinate   | The address of one hex cell, and a node's stable id.                                                                     |
| sealed descriptor | The keyed digest a node's contents derive from, uncorrelated with anything on the geometry plane.                        |
| cleared frontier  | The set of nodes whose first clear has verified; the boundary replay's reachability check reads.                         |
| reveal            | The region a player has earned sight of: a union of hex discs over verified first-clear nodes, derived and never stored. |
| selection         | The set a player may travel to: the origin, cleared nodes, and every node an edge joins to a cleared node.               |
| landmark          | A rare, distance-scaled node granted to an avatar and visible as a pillar of light through fog.                          |
