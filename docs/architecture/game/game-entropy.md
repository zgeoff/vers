# Game entropy & provenance

Every random outcome in the game comes from a small set of entropy sources, and each source's
security properties decide whether the rewards it rolls may carry tradeable value. The client is
untrusted and holds the entire simulation, so the design makes look-ahead unprofitable rather than
trying to prevent it. Tradeability keys on one security property that only some entropy sources
have. The [seed chain](./seed-chain.md) owns the chain data model,
[item generation](./item-generation.md) turns a committed entropy source into concrete item content,
and the [economy modes note](../../game-design/economy-modes.md) owns the reward-content rules.

## Threat model

The client is untrusted and holds the complete simulation. The player can peek at any entropy the
client can compute: simulate the future, inspect the outcome, and choose whether and where to play
it. A deterministic client-simulated game cannot prevent look-ahead: anything the client can
describe, it can pre-compute. The design denies look-ahead its payoff instead of chasing it.

A scanner does not play the average future. It simulates the future on every reachable node, across
the whole offline window, and plays only the best one. Out of 20,000 simulated futures the one that
matters is the single best, so a reward distribution's danger lives in its tail, not its variance.
Modest per-run variance with a rare outlier still hands the scanner a jackpot. That best-of-N
selection value is the quantity these entropy rules price, and the
[economy modes note](../../game-design/economy-modes.md) turns it into the reward-design rules.

## The seed chain

A node's outcomes ride its seed chain, and the chain is client-computable, so offline simulation can
walk any reachable future before the player commits to one. The [seed chain](./seed-chain.md) owns
the chain's row model, its seed derivation, and the transitions that advance and rewind it. Every
attempt advances the chain, a failed or abandoned one exactly as a completed one, and the attempt
after a failure is a fresh continuation rather than a replay. Steering the chain toward a favourable
seed therefore spends real attempts.

The chain seeds only the trajectory: enemies, timing, survival, experience, and which kills commit
rolled rewards. Rolled content resolves separately, at a coordinate fixed by the kill that commits
it. In reward terms, one continuation is worth no more than another. The steady, non-rolled rewards
are public knowledge, rolled-reward density varies only within bounded margins, and each roll's
content carries equal expected value regardless of position. So steering the chain for a better
tradeable reward returns less than the attempts it costs.

Competition scores the trajectory itself (depth, boss-kill speed), which is client-computable and
varies across attempts, so reward-flatness does not cover it. The design bounds the edge a
re-attempt buys by the cost of reaching the position rather than by hiding it. Looking ahead is
free; reaching the position is not:

- An entry-gated target burns a non-refundable entry on every attempt, including abandoned ones, so
  walking the chain toward a favourable seed costs real resources.
- A second competitive avatar is a full endgame build's worth of investment.
- The counted attempt is always played in full.

Depth self-limits, because difficulty scales with depth until a build can no longer clear regardless
of re-attempts. Where near-free abandoned attempts can still churn the chain forward, the design
answers with detection rather than cost; the
[reroll scanning](../../game-design/economy-modes.md#reroll-scanning) section of the economy modes
note owns that stance.

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
at fresh coordinates rather than re-reaching the old ones. Reveal safety does not depend on a roll
having a unique replay identity. Content resolves at equal expected value regardless of position,
and the server discloses a coordinate's content only once the verifier settles its checkpoint. So
re-reaching a position trades one blind roll for an independent roll of equal worth.

Rolled content is `f(key, coordinate)`, where `f` is a keyed PRF: a pseudorandom function whose
revealed outputs carry no predictive power over unrevealed coordinates. The property matters because
the client obtains a known input/output pair at every reveal. The reward's identity is its
coordinate, so minting is idempotent and re-verification can neither duplicate nor re-roll a reward.
The machinery that turns a digest into item content is [item generation](./item-generation.md).

### Key custody

Under trade custody, the avatar key never leaves the server. The verifier reveals a coordinate's
content only once it settles the checkpoint, never at bare append ([seed chain](./seed-chain.md)). A
synced-but-unverified roll holds client-side as pending until then. Connected play settles a kill's
rewards within a batch cadence; a return from offline settles the window's at once. No connectivity
state changes what a committed reward is worth.

Mint at settlement derives every reward under the trade population's key: `readAvatarRollKey` names
that population for every avatar. `ROLL_KEY_ROOTS` carries a root for both populations, and the keys
service derives either population's key on request. The
[economy modes note](../../game-design/economy-modes.md#the-mode-choice) owns the design of that
second custody and why its earnings never reach the market.

### Key derivation

Key derivation obeys these rules:

- Every key comes from a one-way KDF (key derivation function) over a population's root secret. The
  trade and self-found populations are separately rooted, so a self-found key shares no recoverable
  root with any trade key.
- A key is a pure function of its root secret, `avatarID`, and `keyVersion`, re-derivable
  bit-for-bit and never re-randomized.
- Root material lives in one `ROLL_KEY_ROOTS` Fly secret on the standalone keys service, the only
  process that touches it. The payload is JSON with one entry per population, each entry carrying
  its current key version and every hex-encoded root version still derived against. A rotation adds
  a new root version and advances the current pointer; an older version stays so a pinned
  `keyVersion` keeps deriving. Canonical copies and a manual rotation log live in 1Password, and the
  keys service writes one audit log line per derivation.

A leaked trade root makes every future trade drop computable. That is the one unrecoverable failure
this design has.

### Version pinning

The activity's `Started` checkpoint pins every roll, stamping `keyVersion` there beside the engine
and content versions, and `f` resolves content under the pinned versions rather than the live
deploy. So reveal, replay, and mint agree across deploys and root rotations.

### Tail-bearing outcomes

An outcome with a heavy upper tail, such as an affix roll, is the one a scanner selects for, so the
design keeps its entropy sealed on the server until the player commits. The
[crafting entropy note](../../game-design/crafting-entropy.md#sealed-pre-commit-salt) owns that
mechanism. Sealed entropy needs a live round trip, so tail-bearing content is online content
wherever it appears.

## Provenance

Every checkpoint's hashed subset carries an `entropySource` tag naming which source rolled its
outcomes, frozen into the subset from the first row ever written ([seed chain](./seed-chain.md)).
The two values are `server-key` for a server-custody roll and `device-key` for a device-custody
roll. The tag is what lets further sources join without a migration, whether a verifiable-randomness
beacon or a rotated key generation. Replay validates the tag against the avatar's server-recorded
mode, and a mismatch is divergence. Settlement stamps an outcome's provenance from server records
and the tag, never from a client claim.

Tradeability keys on the security property: entropy unpredictable at the moment the outcome was
committed, and provably tied to the party that minted it. Server-custody rolls and sealed salt have
the property; device-custody rolls do not. The delivery channel is irrelevant.

## Mode enforcement

An avatar's economy mode (the [economy modes note](../../game-design/economy-modes.md) owns the
choice) fixes its key custody at creation, permanently. No path converts one custody into the other,
and a device-held key is never repatriated into market eligibility.

## Glossary

| Term                | Meaning                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| entropy source      | A source of random outcomes (the seed chain, an avatar key, sealed salt) whose security properties decide whether its rewards may be tradeable.                                           |
| look-ahead          | Simulating a reachable future offline to inspect its outcome before committing to play it.                                                                                                |
| best-of-N selection | The value a scanner extracts by simulating many futures and playing only the best; the quantity these rules price.                                                                        |
| reward tail         | The rare, large upper end of a reward distribution; where best-of-N selection extracts its value, so tail-bearing entropy stays sealed.                                                   |
| rolled reward       | A reward whose value lives in its roll, committed at a coordinate and revealed later under a key; an item drop is the concrete case.                                                      |
| reward coordinate   | `(avatarID, scopeType, scopeID, chainIndex, ordinal)`, the deterministic position a rolled reward commits at.                                                                             |
| keyed PRF           | A pseudorandom function `f(key, coordinate)` whose revealed outputs carry no predictive power over unrevealed coordinates.                                                                |
| avatar key          | The per-avatar key rolled content derives under; the server holds it under trade custody, and the self-found design holds it on the device.                                               |
| sealed salt         | See [crafting entropy](../../game-design/crafting-entropy.md).                                                                                                                            |
| provenance          | An outcome's recorded security property (its entropy unpredictable at commit and tied to the minter) which decides tradeability; stamped from server records and the `entropySource` tag. |
