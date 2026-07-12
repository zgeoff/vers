# Game entropy & provenance

Where game randomness comes from, and how an entropy source's security properties decide what
rewards may ride it.

## Threat model

The client is untrusted and holds the complete simulation. Any entropy the client can compute, the
player can peek: simulate the future, inspect the outcome, and choose whether — and where — to play
it. Look-ahead cannot be prevented in a deterministic client-simulated game; anything the client can
describe, it can pre-compute. The design prices look-ahead instead of chasing it.

A scanner does not play the average future. It simulates the future on every reachable node, across
the whole offline window, and plays only the best one. Out of twenty thousand simulated futures the
one that matters is the single best, so a reward distribution's danger lives in its tail, not its
variance — modest per-run variance with a rare outlier still hands the scanner a jackpot. That
best-of-N selection value is what every rule below prices; the
[economy modes note](../game-design/economy-modes.md) turns it into the reward-design rules.

## The anchored seed chain

Per `(avatar, node)`, the server anchors an append-only seed chain: the next run's seed derives
deterministically from the stored end of the previous run at that node. The anchor is the last
**verified** checkpoint's end-state at that node. Terminal activity states never advance it past the
verified prefix, and rejecting a stream at version N resets it to the end of version N−1. Abandoning
and restarting therefore replays the same continuation — there is nothing to re-roll. This single
rule closes seed-fishing, death-scumming via early flush, and retry-branch selection.

The chain is client-computable by design — offline simulation depends on it. It seeds the
simulation's trajectory only: enemies, timing, survival, experience, and which kills commit rolled
rewards. Rolled content never derives from it. Foreseeing the trajectory is throughput knowledge —
routing, kill counts, survival — and the economy prices it as such.

## Rolled rewards and the avatar key

A rolled reward is a reward whose value lives in its roll — an item drop is the concrete case. The
commitment comes first, the reveal second: a kill that produces one commits it at a deterministic
coordinate, and its content is rolled from that coordinate later, under a key.

The coordinate is `(avatarID, nodeID, chainIndex, ordinal)`: `chainIndex` counts checkpoints from
the node's seed-chain anchor, and `ordinal` indexes the rolled rewards within a checkpoint under the
simulation's canonical ordering, independent of how checkpoints are batched. The coordinate derives
only from the hashed checkpoint subset.

The coordinate is also restart-stable: the chain replays the same continuation, so abandoning and
restarting reproduces the identical coordinate. That stability is what makes the reveal safe.
Peeking a roll and replaying the position shows the same roll — a peek has zero option value.

Rolled content is `f(key, coordinate)`, where `f` is a keyed PRF — a pseudorandom function whose
revealed outputs carry no predictive power over unrevealed coordinates. The property matters because
every reveal hands the client a known input/output pair. The reward's identity is its coordinate, so
minting is idempotent and re-verification can neither duplicate nor re-roll a reward.

Key custody is the economy boundary:

- **Server-held key** (trade avatars): the key never leaves the server. Content resolves only for
  coordinates whose producing checkpoint is durably appended — no protocol path returns content
  earlier. The append is the commitment, the roll is the reveal. Connected play reveals a kill's
  rewards within a batch cadence; a return from offline reveals the window's rewards at once. No
  connectivity state changes what a committed reward is worth.
- **Device-held key** (self-found avatars): the avatar rolls its own rewards locally, offline, in
  real time. A disclosed key makes every future roll computable, so the key ships only to avatars
  whose earnings can never reach the market. Disclosure is the mode's normal operation, not a
  compromise. The server derives the same key — that is what lets it verify self-found streams and
  restore the key to a new device — so self-found custody is an economic wall, not a privacy
  guarantee.

Key derivation obeys three rules:

- Every key comes from a one-way KDF (key derivation function) over a master secret, and the trade
  and self-found populations are separately rooted: a self-found key shares no recoverable root with
  any trade key.
- A self-found key is a pure function of `(master, avatarID, keyVersion)` — re-derivable
  bit-for-bit, never re-randomized.
- The master secret lives in managed-key custody with rotation and audit, never in an application
  environment variable.

A leaked trade root makes every future trade drop computable. That is the one unrecoverable failure
this design has.

Every roll is pinned by its activity's `Started` snapshot: `keyVersion` is stamped there beside the
engine and content versions, and `f` resolves content under the pinned versions — never the live
deploy — so reveal, replay, and mint agree across deploys, parks, and master rotations.

## Sealed pre-commit salt

Some outcomes carry a tail worth selecting — item affix rolls, rare content. Their entropy stays
sealed while the decision is open, revealed in two commits:

1. **Commit.** The player locks in the spend. The server mints the salt from a server-held secret
   key and stores it sealed. The player sees only a lossy projection derived from it — modifier
   families, difficulty, reward budget — for the preview window. The projection is a distribution
   summary and never narrows the realized roll: walking away must never beat resolving, at any tier,
   and that rule bounds how much the projection may reveal. Every decision happens against this
   metadata; the client never holds computable entropy while a decision is open.
2. **Release.** The server releases the salt and the outcome resolves. Release is commitment: a
   released position the client never resolves is force-resolved as forfeited — the bundle is lost —
   at a server-side deadline inside the replay-retention window.

Three rules keep the seal honest, independent of what consumes it:

- The salt's keying material is a server-held secret. Domain-separation labels alone are
  insufficient: salt derived from client-visible state under a different label is still
  client-computable, and the sealing property collapses.
- Salt is minted once per position and re-fetch is idempotent. A client that loses the response
  retries and receives the same salt, so a lost packet cannot fork the timeline; until the release
  arrives, nothing resolves.
- Every input the outcome depends on pins at mint, so deferring resolution cannot improve it.

Each consumer of the mechanism defines its own position, resolution, and pinned inputs:

- **Juiced instances**: the position is the node-anchored chain position — the same restart-stable
  index that keys reward coordinates — the resolution is the run itself, and the pinned input is the
  build snapshot, so a peeked outcome cannot be beaten by out-leveling first. Forfeiture lifts the
  node's gate.
- **Item crafting**: the position is the craft action in the avatar's crafting sequence, the
  resolution is applying the result to the item, and the pinned inputs are the target item and the
  consumed currency at commit. Application is exactly-once per action — a network retry never
  applies a spend twice.

Sealed salt requires a live round trip, so tail-bearing content is online content wherever it
appears.

Only a tailed distribution needs the seal. A normalized outcome — a chosen tier, an instance
modifier bounded to modest scalars with no jackpot combination — carries no tail worth selecting, so
it rides client-computable entropy anywhere, interactive rerolls included; the
[economy modes note](../game-design/economy-modes.md) owns that rule.

For self-found avatars no entropy is sealable at all — the player holds the key — which is
consistent with their earnings never reaching the market.

## Provenance

Every checkpoint's hashed subset carries an entropy-source tag identifying which source rolled its
outcomes, present from the first row ever written. The subset is frozen, so the tag cannot be added
later — and the tag is what lets entropy sources beyond the current two (a verifiable-randomness
beacon, a rotated key generation) join without a migration. Verification validates the tag against
the avatar's server-recorded mode; a mismatch is divergence. Settlement stamps an outcome's
provenance from server records and the tag — never from a client claim.

Tradeability keys on the security property: entropy unpredictable at the moment the outcome was
committed, and provably tied to the party that minted it. Server-custody rolls and sealed salt have
the property; device-custody rolls do not. The delivery channel is irrelevant.

## Mode enforcement

An avatar's economy mode (the [economy modes note](../game-design/economy-modes.md) owns the choice)
fixes its key custody at creation, permanently. No path converts one custody into the other, and a
device-held key is never repatriated into market eligibility.
