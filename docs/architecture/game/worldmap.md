# The world map

The world map is the graph of places an avatar travels to reach content. Every avatar walks a
different map, unbounded in every direction and harder the farther from its origin it runs. The
server stores no part of the map. The client computes the shape on the device, the server computes
what each place holds, and the wire carries only the nodes a player has revealed.

One split governs everything else. The map's shape is public and any client can compute it, while a
node's contents are sealed and only the server can compute them. The two derive from different
inputs, so knowing the whole shape tells a player nothing about where the reward sits. A public
shape over sealed contents is what makes an infinite client-computed world safe to ship.

The [economy modes note](../../game-design/economy-modes.md#perfect-foresight) owns the threat model
those rules answer, and [game entropy](./game-entropy.md) owns the entropy model. The
[seed chain](./seed-chain.md) owns what happens once an avatar starts playing a node.

## The two planes

Every derived value sits on one of two planes, split by who can compute it.

| Plane    | Derived from                                     | Holds                                       | Who computes it  |
| -------- | ------------------------------------------------ | ------------------------------------------- | ---------------- |
| geometry | `userSeed` and the coordinate                    | positions, edges, difficulty, biome         | anyone           |
| content  | the scope secret, `userSeed`, and the coordinate | the node's sealed reward and encounter pool | the server alone |

`userSeed` is the avatar's own seed. It differs per avatar, so every map differs, and it is not a
secret: shipping it leaks nothing, because the shape it produces is worth nothing on its own. The
client derives the whole infinite map from it in a worker shared across the tabs, so panning never
waits on a round trip.

The scope secret seals the content plane. It is per-avatar, held server-side, and never shipped.
Content folds in the same `userSeed` geometry uses, but without the secret that shared input derives
nothing, so one player's revealed nodes crack no other player's map, and a revealed node discloses
too little to derive its unrevealed neighbours.

## Generating the shape

The generator works one chunk at a time from a stateless hash, so a region around any coordinate
computes without touching the rest. A chunk coordinate addresses a fixed square of hex cells and is
the unit the generator works in. A cell coordinate addresses one hex cell and is a node's identity.

- Cell seeding. A stateless integer hash over the avatar's seed and a cell's coordinate seeds every
  draw, so a cell's values compute straight from its coordinates without generating a neighbour
  first, and regions load in any order. Independent decisions read separate channels of that hash,
  so a node's jitter never correlates with its biome.
- Node placement. Every hex cell carries exactly one node, offset from its centre by a bounded
  jitter that keeps it inside its own hex. Sparse-looking ground is a rendering choice, not an
  absent node.
- Edge connectivity. Two nodes connect when no third node falls inside the circle drawn on that pair
  as its diameter and when they sit within the edge distance cap, a maximum span beyond which no
  pair connects. That makes the graph a distance-capped
  [Gabriel graph](https://en.wikipedia.org/wiki/Gabriel_graph). The test is local, so both sides of
  a chunk border reach the same answer on the same inputs and borders join with no stitching pass.
- Difficulty. A cell's difficulty climbs one step per fixed number of rings out from the origin, up
  to a maximum. The server recomputes it from the coordinate alone.

The graph never splits into islands, because the edge distance cap stays wider than the widest a
jittered neighbouring pair can stretch.

## A node's identity

A node's id is its cell coordinate. The id survives regeneration and the database can reference it,
because `userSeed` varies what a cell contains and which edges leave it, never whether the cell
exists or what it is called. First-clear grants key on the avatar and the node id together. A
coordinate id is what makes a node server-recomputable: the coordinate feeds straight back into the
derivation, so the server reconstructs any node for verification without having stored it.

Spatial queries pack a cell's two axes into one
[Morton](https://en.wikipedia.org/wiki/Z-order_curve) key, so nearby cells sort close together and a
viewport box covers a handful of one-dimensional ranges. That packing bounds how far from the origin
a cell can be addressed, and a cell outside that bound is refused rather than wrapped.

## What a player may see

Map reveal is wide and derived. The server projects the revealed region as one hex disc of the
reveal radius around every node the avatar has cleared and had verified, plus one around the origin
so a new avatar sees its starting ground. A node is revealed when it falls inside any of those
discs. The radius is a security limit, because look-ahead value climbs with it.

No reveal state is stored, so the projection is idempotent by construction, and storage grows with
the nodes an avatar has completed, never with the area it can see.

The server discloses a node only after the clear that opened it verifies, never on an optimistic
one. It discloses the node's difficulty and its sealed content fields, never the secret those fields
derive from, and it caps how many nodes one clear can fan out to. A request for one specific node is
served ahead of the bulk fan-out, so the online path stays responsive.

A reveal request names specific nodes, and the server authorizes each against its own projection
rather than trusting the list. A node the projection does not cover discloses nothing and mints no
seed chain. The server drops that node from the response instead of refusing the whole request, and
it counts every refusal.

## Where a player may travel

Travel selection is narrow, and it uses a different rule from reveal. A node is selectable when it
is the origin, when the avatar has already cleared it, or when an edge joins it to a node the avatar
has cleared. Reveal measures hex distance; selection follows edges. A revealed node two hops away
with no edge to a cleared node is visible and unreachable, and that is the intended shape of the
boundary.

The server holds that boundary. The avatar's cleared frontier, the set of nodes whose first clear
has verified, bounds travel: replay rejects an activity at a node that borders no node on the
frontier ([replay verification](./replay-verification.md#replay)). Client and server derive edges
from identical inputs, so they never disagree about which nodes connect.

### Playing past the frontier offline

The server discloses every node in the revealed region, which reaches past what the avatar can
travel to, and the client caches them. Offline, a player farms the nodes they can already see and
pushes outward into ground the fog has already lifted from. Reward-magnitude variance lives in
sealed entropy drawn online
([crafting entropy](../../game-design/crafting-entropy.md#sealed-pre-commit-salt)), so reading a
node's base early buys nothing.

Clearing a node offline opens its neighbours for selection before the server verifies the clear: the
client widens its selectable set from the device's outbox
([offline reconcile](./offline-reconcile.md)). That widening only ever adds to selection. Reveal
stays gated on verification, so an offline clear lifts no new fog, and replay still rejects a node
past the cleared frontier.

## Sealing a node's contents

A node's contents derive from a sealed descriptor: a keyed digest, under the avatar's scope secret,
over a frozen encoding of the coordinate and `userSeed`. The digest is uncorrelated with everything
on the geometry plane, and no client can reproduce it without the secret.

The content derivation reads that digest and nothing else from the map. It takes no distance, no
node degree, no region shape, and no biome, so no client-visible channel can predict what a node
holds. Each content version registers its own pool list, and the digest picks from it uniformly
without consuming any simulation randomness.

The content derivation is constant-time and stores nothing. The server derives a node's enemies when
an activity is admitted, and the verifier derives them again at replay, so no stored row exists to
forge.

Every activity row carries a scope-secret reference and version as columns of its own, never as
fields inside the checkpoint stream. The reference names only a versioned root the keys service
custodies ([key derivation](./game-entropy.md#key-derivation)). The verifier re-derives the node's
difficulty and sealed fields on each stream's first pass and rejects a mismatch.

## Biome, the terrain plane

Biome is how the ground looks, so it renders on the client and sits on the geometry plane. A player
sees it through fog before reaching it.

The generator samples terrain in two independent layers. A base layer paints regional patches from a
low-frequency hybrid of [Worley](https://en.wikipedia.org/wiki/Worley_noise) and
[value noise](https://en.wikipedia.org/wiki/Value_noise), with each biome's rarity banded by
distance from the origin. A second layer paints a rarer modifier over the top, spanning several base
patches. Both sample at any real position, not only at cell centres, so a renderer can fill a texel
grid between nodes.

Terrain draws as node territories. Every point of ground takes the biome of its nearest jittered
node, a patch is the union of its nodes' territories, and borders weave between nodes so no node
ever sits on one. Node jitter alone makes those borders wander, and a tint crossfade softens the
border where two territories wear different biomes.

Content ignores biome ([sealing a node's contents](#sealing-a-nodes-contents)), so a client cannot
read terrain as a predictor of a node's reward. A reward may vary by biome only through a public
term every client can compute.
