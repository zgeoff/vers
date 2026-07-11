# Game entropy & provenance

Where game randomness comes from, and how an entropy source's security properties decide what
rewards may ride it.

## Threat model

The client is untrusted and holds the complete simulation, so any entropy the client can compute is
entropy the player can peek: simulate the future, inspect the outcome, and choose whether — and
where — to play it. Look-ahead cannot be prevented in a deterministic client-simulated game;
anything the client can describe, it can pre-compute. The design prices look-ahead instead of
chasing it.

The quantity that matters is selection value, and it is an order statistic: a scanner takes the best
future across every reachable node and the whole offline window, so a reward distribution's danger
lives in its tail, not its variance. Modest per-run variance with a rare outlier still hands a
scanner a jackpot, because best-of-twenty-thousand lives in the tail. The
[economy modes note](../game-design/004-economy-modes.md) turns this into the reward-design rules.

## The anchored seed chain

Per `(avatar, node)`, the server anchors an append-only seed chain: the next run's seed derives
deterministically from the stored end of the previous run at that node. The anchor is the last
**verified** checkpoint's end-state at that node: terminal activity states never advance it past the
verified prefix, and rejecting a stream at version N resets it to the end of version N−1. Abandoning
and restarting therefore replays the same continuation — there is nothing to re-roll. This single
rule closes seed-fishing, death-scumming via early flush, and retry-branch selection.

The chain is client-computable by design — offline simulation depends on it — and it seeds the
simulation's trajectory only: enemies, timing, survival, experience, and which kills yield drop
slots. Drop content never derives from it. Foreseeing the trajectory is throughput knowledge —
routing, kill counts, survival — and the economy prices it as such.

## Drop rolls and the avatar key

A kill that yields loot produces a drop slot at a deterministic coordinate
`(avatarID, nodeID, chainIndex, ordinal)`, where `chainIndex` counts checkpoints from the node's
seed-chain anchor and `ordinal` indexes the drops within a checkpoint under the simulation's
canonical ordering, independent of how checkpoints are batched. The coordinate derives only from the
hashed checkpoint subset, and it is restart-stable: because the chain replays the same continuation,
abandoning and restarting reproduces the identical coordinate. That stability is what makes the
reveal safe — peeking a roll and replaying the position shows the same roll, so a peek has zero
option value.

The slot is a commitment; the item is its reveal. Drop content is `f(key, coordinate)` where `f` is
a keyed PRF — revealed outputs carry no predictive power over unrevealed coordinates, which matters
because every reveal hands the client a known input/output pair. Item identity is the coordinate, so
minting is idempotent and re-verification can neither duplicate nor re-roll an item.

Key custody is the economy boundary:

- **Server-held key** (trade avatars): the key never leaves the server, and content resolves only
  for coordinates whose producing checkpoint is durably appended — no protocol path returns content
  earlier. The append is the commitment, the roll is the reveal: connected play reveals drops within
  a batch cadence of the kill, a return from offline reveals the window's drops at once, and no
  connectivity state changes what a slot is worth.
- **Device-held key** (self-found avatars): the avatar rolls its own loot locally, offline, in real
  time. A disclosed key makes every future roll computable, so the key ships only to avatars whose
  earnings can never reach the market. Disclosure is the mode's normal operation, not a compromise —
  and the server derives the same key, which is what lets it verify self-found streams and restore
  the key to a new device. Self-found custody is an economic wall, not a privacy guarantee.

Key derivation is a one-way KDF from a master secret, with the trade and self-found populations
separately rooted: a self-found key must share no recoverable root with any trade key. A self-found
key is a pure function of `(master, avatarID, keyVersion)` — re-derivable bit-for-bit, never
re-randomized. The master secret requires managed-key custody with rotation and audit, never an
application environment variable; a leaked trade root makes every future trade drop computable,
which is the one unrecoverable failure this design has.

Every roll is pinned by its activity's `Started` snapshot: `keyVersion` is stamped there beside the
engine and content versions, and `f` resolves content under the pinned versions — never the live
deploy — so reveal, replay, and mint agree across deploys, parks, and master rotations.

## Sealed pre-commit salt

Outcomes whose distribution carries a tail worth selecting — item affix rolls, rare content — draw
entropy that must stay sealed while a crafting decision is open, revealed in two commits:

1. **Commit.** The player locks in the spend. The server mints the salt from a server-held secret
   key and stores it sealed, returning only a lossy derived projection — modifier families,
   difficulty, reward budget — for the preview window. The projection is a distribution summary and
   never narrows the realized roll: walking away must never beat resolving, at any tier, and the
   projection's information content is bounded by that rule. All crafting decisions happen against
   the metadata; the client never holds simulatable entropy while a decision is open.
2. **Run-commit.** The salt is released and the client simulates. Release is commitment: a committed
   position the client never resolves is force-resolved as forfeited — the bundle is lost and the
   node's gate lifts — at a server-side deadline inside the replay-retention window.

The salt's keying material is a server-held secret. Domain-separation labels alone are insufficient:
salt derived from client-visible state under a different label is still client-computable, and the
sealing property collapses.

Salt is minted once per node-anchored chain position — the same restart-stable index that keys drop
coordinates — and re-fetch is idempotent: a client that loses the response retries and receives the
same salt, so a lost packet cannot fork the timeline, and until the release arrives the run does not
start. The build snapshot pins at mint, so deferring resolution cannot improve an outcome by
out-leveling it first.

Sealed salt requires a live round trip, so tail-bearing crafted content is online content. Entropy
placement follows the outcome distribution, not the mechanic: a normalized outcome — a chosen tier,
an instance modifier bounded to modest scalars with no jackpot combination — carries no tail worth
selecting, so it rides client-computable entropy anywhere, interactive rerolls included. Peeking a
tail-free distribution reveals nothing worth acting on; only a tailed distribution needs the seal.
For self-found avatars no entropy is sealable at all — the player holds the key — which is
consistent with their earnings never reaching the market.

## Provenance

Every checkpoint's hashed subset carries an entropy-source tag identifying which source rolled its
outcomes, present from the first row ever written — the subset is frozen, so the tag cannot be added
later, and it is what allows entropy sources beyond the current two (a verifiable-randomness beacon,
a rotated key generation) to join without a migration. Verification validates the tag against the
avatar's server-recorded mode; a mismatch is divergence. Settlement stamps an outcome's provenance
from server records and the tag — never from a client claim.

Tradeability keys on the security property — entropy unpredictable at the moment the outcome was
committed, and non-repudiable — not on which channel delivered it. Server-custody rolls and sealed
salt have the property; device-custody rolls do not.

## Mode enforcement

An avatar's economy mode (the [economy modes note](../game-design/004-economy-modes.md) owns the
choice) fixes its key custody at creation, permanently. No path converts one custody into the other:
connectivity changes when a trade avatar's rolls reveal, never what they are worth, and a
device-held key is never repatriated into market eligibility.
