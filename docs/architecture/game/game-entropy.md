# Game entropy & provenance

Every random outcome in the game comes from a named entropy source, and each source's security
properties decide whether the rewards it rolls may carry tradeable value. The client is untrusted
and holds the entire simulation, so the design makes look-ahead unprofitable rather than trying to
prevent it; the [economy modes note](../../game-design/economy-modes.md) owns that threat model and
the reward-content rules it produces. The [seed chain](./seed-chain.md) owns the chain data model,
and [item generation](./item-generation.md) turns a committed entropy source into concrete item
content.

## The seed chain

A node's outcomes ride its seed chain, and the chain is client-computable, so offline simulation can
walk any reachable future before the player commits to one. Steering the chain toward a favourable
seed spends real attempts, because a failed attempt spends its positions exactly as a completed one
does ([seed chain](./seed-chain.md)).

The chain seeds only the trajectory: enemies, timing, survival, experience, and which kills commit
rolled rewards. Rolled content resolves separately, at a coordinate fixed by the kill that commits
it, and each roll carries equal expected value regardless of position. In reward terms, one
continuation is worth no more than another, so steering the chain for a better tradeable reward
returns less than the attempts it costs. Where near-free abandoned attempts can still churn the
chain forward, the design answers with detection
([reroll scanning](../../game-design/economy-modes.md#reroll-scanning)).

## Rolled rewards

A rolled reward is a reward whose value lives in its roll; an item drop is the concrete case. A kill
commits a rolled reward at a deterministic coordinate, and the server rolls its content from that
coordinate later, under a key.

### The reward coordinate

The coordinate is `(avatarID, scopeType, scopeID, chainIndex, ordinal)`. The chain index counts
checkpoints along the chain and is monotonic across activities, so a failed attempt's indices are
spent rather than reused. The ordinal indexes the rolled rewards within a checkpoint under the
simulation's canonical ordering, independent of how checkpoints are batched. The coordinate derives
only from the frozen set of fields each checkpoint hashes, so replaying the chain reproduces every
coordinate exactly.

### Reward reveal

Content resolves at equal expected value regardless of position, and the server discloses a
coordinate's content only once the verifier settles its checkpoint
([applying verified progress](./replay-verification.md#applying-verified-progress)), so re-reaching
a position trades one blind roll for an independent roll of equal worth.

Rolled content is `f(key, coordinate)`, where `f` is a keyed pseudorandom function (PRF): its
revealed outputs carry no predictive power over unrevealed coordinates. The property matters because
the client obtains a known input and output pair at every reward reveal. The reward's identity is
its coordinate. [Item generation](./item-generation.md) turns the digest into item content.

### Key custody

Under trade custody, the avatar key never leaves the server, and mint at settlement derives every
reward under the trade key. Connected play settles a kill's rewards as its checkpoint batches
verify, and a return from offline settles the whole window at once; no connectivity state changes
what a committed reward is worth. An avatar's economy mode fixes its key custody at creation,
permanently. The [economy modes note](../../game-design/economy-modes.md#the-mode-choice) owns the
design of device custody and why its earnings never reach the market.

### Key derivation

- Every key comes from a one-way key derivation function over a population's root secret. The trade
  and self-found populations are separately rooted, so a self-found key shares no recoverable root
  with any trade key.
- A key is a pure function of its root secret, the avatar id, and the key version, re-derivable
  bit-for-bit and never re-randomized.
- Root material lives only on the standalone keys service, the one process that touches it. A
  rotation adds a new root version and advances the current pointer, and an older version stays so a
  pinned key version keeps deriving. Canonical copies and a manual rotation log live in 1Password,
  and the keys service writes one audit log line per derivation.

A leaked trade root makes every future trade drop computable.

## Version pinning

The activity's `Started` checkpoint stamps the key version beside the engine and content versions.
Content resolves under the stamped versions, never the live deploy. Reveal, replay, and mint
therefore agree across deploys and root rotations.

## Provenance

Every checkpoint's hashed field set carries an `entropySource` tag naming which source rolled its
outcomes. The two values are `server-key` for a server-custody roll and `device-key` for a
device-custody roll. Replay validates the tag against the avatar's server-recorded mode, and a
mismatch is divergence. Settlement stamps an outcome's provenance from server records and the tag,
never from a client claim.

Tradeability keys on one security property: entropy unpredictable at the moment the outcome was
committed, and provably tied to the party that minted it. Server-custody rolls and sealed salt have
the property; device-custody rolls do not. An outcome with a heavy upper tail, such as an affix
roll, is the one a scanner selects for, so its entropy stays sealed on the server until the player
commits; the [crafting entropy note](../../game-design/crafting-entropy.md#sealed-pre-commit-salt)
owns that mechanism.
