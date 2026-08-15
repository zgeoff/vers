# The seed chain

Every `(avatar, chain scope)` pair owns one forward, append-only seed chain. A chain scope is a
`(scope_type, scope_id)` pair identifying a stable, returnable target — the world map's node is the
`world_map_node` scope. Each activity at the scope draws its seed from the chain's current position
and advances it, so the next activity continues from where the last one left off. A completed,
failed, or abandoned attempt advances it alike, so a re-attempt is a fresh continuation, never a
replay. This page is the chain's data model and lifecycle; the
[entropy model](./game-entropy.md#the-seed-chain) covers why the chain takes this shape and how its
flatness prices look-ahead.

## The chain row

`activity_chains`, keyed `(avatar_id, scope_type, scope_id)`, holds the chain's state as two
cursors:

- The **appended anchor** (`appended_next_seed`, `appended_chain_index`) is the derivation source. A
  new activity seeds from it. It moves the instant an activity's tail is written, ahead of
  verification, so offline play never waits on the verifier.
- The **verified anchor** (`verified_next_seed`, `verified_chain_index`) is the settlement watermark
  and the rollback target. Settlement trusts positions at or below it.

`genesis_seed` records the origin seed. The row carries no `updated_at` column and no on-update
trigger, so a reveal that self-assigns `genesis_seed` to keep the mint idempotent bumps no timestamp
and writes no logical change.

The chain row spans a scope's activities. A
[checkpoint stream](./game-simulation.md#checkpoint-streams) and its head-row cursors span a single
activity.

## Seeds and chainIndex

A seed is a 128-bit xoroshiro128+ state carried as a 32-character hex string. A continuation seed is
the previous activity's final checkpoint `nextSeed`, copied verbatim: the derivation is identity.
The verifier reproduces the seed from the appended chain rather than trusting a submitted value.

`chainIndex` counts checkpoints along the whole chain, monotonic across activities so a failed
attempt's positions are spent, never reused. An activity carries `start_chain_index`, stamped at
start from the chain's appended cursor. A checkpoint's `chainIndex` is
`start_chain_index + version`, where `version` is its 1-based position in the activity's stream. The
`Started` checkpoint sits at `start_chain_index + 1`. Reward coordinates and sealed-salt positions
key on this value.

`chainIndex` sits in the checkpoint's frozen hashed subset, so replay reproduces every coordinate.
The server validates each checkpoint's `chainIndex` against `start_chain_index + version`.

## Genesis

A chain scope's genesis seed is a server CSPRNG mint: sixteen random bytes as hex, re-rolled off the
degenerate all-zero xoroshiro state. `revealNodes` mints it at reveal time, one chain row per
revealed `(avatar, scope)` pair. A repeat reveal self-assigns the row's own `genesis_seed`, so the
mint stays idempotent under any number of concurrent callers. The seed needs no re-derivation: the
verifier reads the stored value, and a restored device fetches it. A client cannot compute the seed
or steer it, because the scope and the avatar are both fixed before the mint.

The interactive start is a local client mint. The worker synthesizes the activity's full root row
from this device's cached inputs, without calling the service.

`revealNodes` returns each node's current `head` alongside its genesis seed. The head is the chain
row's appended anchor, `{ nextSeed, chainIndex }`. A start roots at the head, so it resumes where
play on the node last left off rather than restarting from genesis. A node never yet played has a
head of `{ genesisSeed, 0 }`.

The service's `startActivity` handler still mints a root from the chain head the same way, but the
interactive start no longer calls it. Auto-continuation after a terminal checkpoint still calls it.
An interactive start's locally minted root is never round-tripped to the server ahead of its own
checkpoints; `advanceActivity` accepts one directly only for the offline-first ingest below.

`revealNodes` also returns each node's `encounterNode`, the content version it was derived against,
and the key version and scope-secret ref and version the derivation read. With the sim version the
client already holds, these are every input `buildStartHash` needs.

app-web calls `revealNodes` for every node the fog-of-war projection reveals and relays the seeds,
heads, encounters, and stamps to the idle worker with the active avatar. The worker caches each
node's seed, head, encounter, and content version under its `[avatarID, nodeID]` key in the
`node-seeds` IndexedDB store, and the stamps in the `preferences` store. Every node the player can
see then carries what a start needs to synthesize a valid root without the server.

The node key scopes a seed to its avatar. Two avatars sharing a coordinate root distinct chains
against distinct seeds, so neither overwrites the other's cached value.

The checkpoint submitter's write cursor persists a node's advancing head back to its cache row as
the client plays the chain forward. A later start at that node then roots against the position this
device has reached, not the reveal's original head.

Every synthesized root is written to the durable `pending-roots` IndexedDB store, keyed by its
activity id, before it installs onto the live simulation. A crash between mint and install still
leaves a recoverable root.

`advanceActivity` accepts such a root directly when the caller reconnects with one still
unsubmitted: the same client-computed start context, ingested under `startActivity`'s own admission
gates and validated against the chain's live appended anchor rather than trusted as fresh. The
anchor check is exact — the root's `startChainIndex` must equal `appendedChainIndex` and its seed
must equal `appendedNextSeed` — so a root computed against a head the chain has since moved past is
refused rather than layered onto a position that no longer exists.

## Advancing the chain

The chain advances on an activity's transition out of `active`. Which cursor moves depends on
whether the appended tail is trustworthy.

### Forward exits

A terminal checkpoint (completed or failed), a user stop, and an offline cap all leave honest
progress. The request path advances `appended_next_seed` and `appended_chain_index` from the last
appended checkpoint. A compare-and-swap on the activity's `start_chain_index` guards the advance, so
a duplicate transition moves nothing. An activity that appended nothing leaves the anchor untouched,
as does one whose only checkpoint is `Started` — its `nextSeed` equals the seed, so nothing was
consumed.

### Adverse exits

Reproducible divergence rejects a stream. Repeated ambiguity quarantines it. The appended tail is
then suspect and never advances the appended anchor.

A rejection rewinds the appended anchor to the verified anchor in one self-referential statement,
setting `appended_next_seed = verified_next_seed` and `appended_chain_index = verified_chain_index`
from the row's own columns. A successor that already rooted past the verified point
(`start_chain_index > verified_chain_index`) is void: its forward-advance compare-and-swap can no
longer match, and nothing further settles from it. Whatever it settled while verifying stands. A
quarantine blocks new activity starts on the pair. Every other chain scope proceeds.

Session eviction changes the writer, not the activity. The activity stays `active`, and a new
session resumes it from the verified anchor. The tail is adjudicated on its own merits. Eviction
advances nothing.

## Settlement and reveal

Identity settlement and rolled-reward reveal gate on verification, never on the appended head, so
nothing unproven is paid. Verification's unit is the segment: a stream is adjudicated in pieces as
it arrives, and each piece settles what it proved. A run stopped, capped, or held part way through
keeps the xp its verified prefix earned, and an item minted for a verified segment stays minted. A
rejection voids the chain's unverified remainder and every successor rooted past the verified
anchor; it reverses no payout. A synced but unverified reward holds as a pending item on the client
until the verifier settles it.

The xp a checkpoint carries is read two ways. A non-terminal checkpoint's `rewards.xp` is that
checkpoint's own delta; a terminal one's is the run's final total, containing every delta before it.
A segment therefore settles either the sum of the deltas it verified or, when it ends on a terminal,
that total less what earlier segments settled. The per-activity running total moves in the same
guarded update that advances the verified cursor, so the cursor and the amount cannot disagree.

A consequential read — a new activity's `buildSnapshot`, a future point spend, anything feeding a
new run — includes an ended run's unsettled remainder, so a player who finishes one run and
immediately starts another builds against what they just earned. A held run is excluded: `parked`
and `quarantined` reach verification only by operator action, so counting one would stamp xp that
never settles into this run's snapshot and every later one.

A borrowed remainder records where it came from. An activity's snapshot provenance is the set of
unverified runs whose xp moved its total, stored at start; one that moved it by nothing lends
nothing and is left out. Xp is the only quantity a snapshot borrows ahead of verification, an item
minting only for a verified segment, so a quantity added to the snapshot widens what provenance
records. Identity is avatar-global while chains are per-scope, so a borrow crosses chains, and
provenance is what orders them against each other:

- A chain is unclaimable while its replay frontier has a source with appends past its own verified
  cursor. Provenance points at runs that had already ended when the borrower started, so the
  ordering is acyclic and holds transitively.
- A frontier whose source rejected is refused without replaying its stream, there being no proven
  total left to replay against. Its own borrowers fail the same check in turn, so one rejection
  reaches every dependent through the single-chain rejection path.
- A source under an operator hold keeps its borrowers waiting, since a hold that later rejects would
  leave the same unproven total in place. The borrowing chain stalls until the hold clears.
- A borrower still running when its source falls is refused at its next adjudication, since a chain
  is inspected only when it has appends to verify.

`getAvatarProgression` reads the settled row, its pending projection, and the live run's
settled-so-far in a single statement, so a client display is never torn between them. The pending
projection holds one entry per ended-but-unsettled activity, computed as the inverse of what
verification settles: a settlement moves a delta from the pending set into the settled row without
changing their sum, and a build snapshot stamped from the pair matches what verification pays. The
pending projection is display-only.

## Concurrency

- The verifier serializes a chain's activities on the chain row, adjudicating one at a time in
  order, so a continuation never confirms against a predecessor that later rejects.
- A chain waits on the runs its replay frontier borrowed xp from, ordering an avatar's chains
  against each other while no writer holds more than the one chain row it claimed.
- The request-path forward-advance and the verifier both acquire the chain row before the activity
  row, a single ordering that admits no cycle.
- The rejection rewind reads the verified columns inline in its update statement, never through a
  prior select, so a concurrent confirm cannot slip between the read and the write.
