# Game entropy & provenance

Every random outcome in the game comes from a small set of entropy sources, and each source's
security properties decide whether the rewards it rolls may carry tradeable value. The client is
untrusted and holds the entire simulation, so the design makes look-ahead unprofitable rather than
trying to prevent it. Tradeability keys on one security property that only some entropy sources
have. The [seed chain](./seed-chain.md) owns the chain data model,
[item generation](./item-generation.md) turns a committed entropy source into concrete item content,
and the [economy modes note](../../game-design/economy-modes.md) owns the reward-content rules.

## Threat model

The client is untrusted and holds the complete simulation. Any entropy the client can compute, the
player can peek: simulate the future, inspect the outcome, and choose whether and where to play it.
Look-ahead cannot be prevented in a deterministic client-simulated game: anything the client can
describe, it can pre-compute. The design denies look-ahead its payoff instead of chasing it.

A scanner does not play the average future. It simulates the future on every reachable node, across
the whole offline window, and plays only the best one. Out of twenty thousand simulated futures the
one that matters is the single best, so a reward distribution's danger lives in its tail, not its
variance. Modest per-run variance with a rare outlier still hands the scanner a jackpot. That
best-of-N selection value is the quantity these entropy rules price, and the
[economy modes note](../../game-design/economy-modes.md) turns it into the reward-design rules.

## The seed chain

A node's outcomes ride its seed chain, and the chain is client-computable, so offline simulation can
walk any reachable future before the player commits to one. The [seed chain](./seed-chain.md) owns
the chain's row model, its seed derivation, and the transitions that advance and rewind it. Every
attempt advances the chain, a failed or abandoned one exactly as a completed one, and the attempt
after a failure is a fresh continuation rather than a replay. Steering the chain toward a favorable
seed therefore spends real attempts.

The chain seeds the trajectory only: enemies, timing, survival, experience, and which kills commit
rolled rewards. Rolled content resolves separately, at a coordinate fixed by the kill that commits
it. In reward terms one continuation is worth no more than another. Steady rewards are published,
rolled-reward density varies only within bounded margins, and each roll's content carries equal
expected value regardless of position. So steering the chain for a better tradeable reward returns
less than the attempts it costs.

Competition scores the trajectory itself (depth, boss-kill speed), which is client-computable and
varies across attempts, so reward-flatness does not cover it. Meaningful competition is endgame, and
the edge a re-attempt buys is bounded by the cost of reaching the position rather than by hiding it.
The peek is free; the position is not:

- An entry-gated target burns a non-refundable entry on every attempt, abandons included, so walking
  the chain toward a favorable seed is paid for in resources.
- A second competitive avatar is a full endgame build's worth of investment.
- The counted attempt is always played in full.

Depth self-limits, because difficulty scales with depth until a build can no longer clear regardless
of re-attempts.

Where a metric is open enough that near-free abandoned attempts can churn the chain forward, cost
stops gating and detection takes over: an avatar whose results ride the favorable tail of its
verified history is a behavioural cheat signal, scored offline
([game simulation](./game-simulation.md#replay)). Bounded margins keep any single attempt's edge
small throughout. The residual is a wealthy, motivated actor with a purpose-built tool: defended in
layers, never zero, the ceiling of anti-cheat in any game.

## Rolled rewards and the avatar key

A rolled reward is a reward whose value lives in its roll; an item drop is the concrete case. The
commitment comes first, the reveal second: a kill that produces one commits it at a deterministic
coordinate, and its content is rolled from that coordinate later, under a key.

### The reward coordinate

The coordinate is `(avatarID, scopeType, scopeID, chainIndex, ordinal)`. `chainIndex` counts
checkpoints along the chain and is monotonic across activities, so a failed attempt's indices are
spent rather than reused ([seed chain](./seed-chain.md)). `ordinal` indexes the rolled rewards
within a checkpoint under the simulation's canonical ordering, independent of how checkpoints are
batched. The coordinate derives only from the hashed checkpoint subset, so replaying the chain
reproduces every coordinate exactly.

### Reveal safety

A failed or abandoned attempt advances the chain past its spent indices, so the next attempt rolls
at fresh coordinates rather than re-reaching the old ones. The reveal needs no replay-identity to
stay safe. Content resolves at equal expected value regardless of position, and under server custody
a coordinate's content is not revealed until the verifier settles its checkpoint. So re-reaching a
position trades one blind roll for an independent roll of equal worth. Device custody lets a
self-found avatar read its own rolls before committing, but its loot never reaches a market, and any
standing it earns rides the same appended, verifiable record.

Rolled content is `f(key, coordinate)`, where `f` is a keyed PRF: a pseudorandom function whose
revealed outputs carry no predictive power over unrevealed coordinates. The property matters because
every reveal hands the client a known input/output pair. The reward's identity is its coordinate, so
minting is idempotent and re-verification can neither duplicate nor re-roll a reward. The machinery
that turns a digest into item content — the shared interpreter, draw-order versioning, and craft
positions — is [item generation](./item-generation.md).

### Key custody

Key custody is the economy boundary:

- **Server-held key** (trade avatars): the key never leaves the server, and a coordinate's content
  is revealed only once the verifier settles its checkpoint, never at bare append
  ([seed chain](./seed-chain.md)). A synced-but-unverified roll holds client-side as pending until
  then. Connected play settles a kill's rewards within a batch cadence; a return from offline
  settles the window's at once. No connectivity state changes what a committed reward is worth.
- **Device-held key** (self-found avatars): the avatar rolls its own rewards locally, offline, in
  real time. A disclosed key makes every future roll computable, so the key ships only to avatars
  whose earnings can never reach the market. Disclosure is the mode's normal operation, not a
  compromise. The server derives the same key, which is what lets it verify self-found streams and
  restore the key to a new device. So self-found custody is an economic wall, not a privacy
  guarantee.

### Key derivation

Key derivation obeys these rules:

- Every key comes from a one-way KDF (key derivation function) over a population's root secret. The
  trade and self-found populations are separately rooted, so a self-found key shares no recoverable
  root with any trade key.
- A self-found key is a pure function of its root secret, `avatarID`, and `keyVersion`, re-derivable
  bit-for-bit and never re-randomized.
- Root material lives in one `ROLL_KEY_ROOTS` Fly secret on the standalone keys service, the only
  process that touches it. The payload is JSON with one entry per population, each entry carrying
  its current key version and every hex-encoded root version still derived against. A rotation adds
  a new root version and advances the current pointer; an older version stays so a pinned
  `keyVersion` keeps deriving. Canonical copies and a manual rotation log live in 1Password, and
  every derivation is audit-logged.

A leaked trade root makes every future trade drop computable. That is the one unrecoverable failure
this design has.

### Version pinning

Every roll is pinned by its activity's `Started` snapshot. `keyVersion` is stamped there beside the
engine and content versions, and `f` resolves content under the pinned versions rather than the live
deploy. So reveal, replay, and mint agree across deploys and root rotations.

## Sealed pre-commit salt

Some outcomes carry a tail worth selecting; item affix rolls are the concrete case. Their entropy
stays sealed while the decision is open and reveals in two committing moves, commit then release.

### Commit and release

**Commit.** The player locks in the spend. The server mints the salt from a server-held secret key
and stores it sealed. The player sees only a lossy projection derived from it — modifier families,
difficulty, reward budget — for the preview window. The projection is a distribution summary and
never narrows the realized roll: walking away must never beat resolving, at any tier, and that rule
bounds how much the projection may reveal. Every decision happens against this metadata, and the
client never holds computable entropy while a decision is open.

**Release.** The server resolves the outcome under the salt and returns the result; under server
custody the salt itself never reaches the client. Release is commitment: a released position the
client never resolves is force-resolved as forfeited — the bundle is lost — at a server-side
deadline inside the replay-retention window.

### Keeping the seal honest

Three rules keep the seal honest, independent of what consumes it:

- The salt's keying material is a server-held secret. Domain-separation labels alone are
  insufficient: salt derived from client-visible state under a different label is still
  client-computable, and the sealing property collapses.
- Salt is minted once per position and re-fetch is idempotent. A client that loses the response
  retries and receives the same salt, so a lost packet cannot fork the timeline; until the release
  arrives, nothing resolves.
- Every input the outcome depends on pins at mint, so deferring resolution cannot improve it.

### What the seal admits

The mechanism admits any tail-bearing outcome; each consumer defines its own position, resolution,
and pinned inputs. Item crafting is the worked case: the position is the craft action in the
avatar's crafting sequence, the resolution is applying the result to the item, and the pinned inputs
are the target item and the consumed currency at commit. Application is exactly-once per craft
position, so a network retry never applies a spend twice ([item generation](./item-generation.md)).
A craft's affixes draw this sealed salt; a base drop's content resolves under the avatar key
instead, and the two mechanisms never compose within one outcome.

Sealed salt requires a live round trip, so tail-bearing content is online content wherever it
appears.

### What must be sealed

Only a rolled tail needs the seal. A chosen tier at a published scalar carries no tail worth
selecting and rides client-computable entropy anywhere, interactive selection included. A rolled
magnitude does carry a tail: bounded is not flat, and best-of-N selects the maximum of a bounded
spread as readily as an unbounded one. So any modifier that rolls a market-grade quantity (yield,
roll or pack count, density) is a rolled reward under the tail rule and must be sealed or forbidden.
The [economy modes note](../../game-design/economy-modes.md) owns the content rule.

For self-found avatars no entropy is sealable at all, because the player holds the key. That is
consistent with their earnings never reaching the market.

## Provenance

Every checkpoint's hashed subset carries an `entropySource` tag naming which source rolled its
outcomes, frozen into the subset from the first row ever written ([seed chain](./seed-chain.md)).
The two values today are `server-key` for a server-custody roll and `device-key` for a
device-custody roll. The tag is what lets further sources join without a migration, whether a
verifiable-randomness beacon or a rotated key generation. Replay validates the tag against the
avatar's server-recorded mode, and a mismatch is divergence. Settlement stamps an outcome's
provenance from server records and the tag, never from a client claim.

Tradeability keys on the security property: entropy unpredictable at the moment the outcome was
committed, and provably tied to the party that minted it. Server-custody rolls and sealed salt have
the property; device-custody rolls do not. The delivery channel is irrelevant.

## Mode enforcement

An avatar's economy mode (the [economy modes note](../../game-design/economy-modes.md) owns the
choice) fixes its key custody at creation, permanently. No path converts one custody into the other,
and a device-held key is never repatriated into market eligibility.
