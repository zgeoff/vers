# The seed chain

Every `(avatar, chain scope)` pair owns one forward, append-only seed chain. A **chain scope** is a
`(scope_type, scope_id)` pair naming a stable, returnable target — a world-map node is the
`world_map_node` scope. Each activity at the scope draws its seed from the chain's current position
and advances it, so the next activity continues where the last left off. A completed, failed, or
stopped attempt advances the chain alike, so a re-attempt is a fresh continuation, never a replay.

The chain's whole state is two cursors: an **appended anchor** the next activity seeds from, and a
**verified anchor** that progress settles behind. The appended anchor moves the instant an
activity's tail is written; the verified anchor moves only once the server has replayed that tail
and trusted it. That gap — appended ahead, verified behind — is what offline play and settlement
both turn on.

The [entropy model](./game-entropy.md#the-seed-chain) covers why the chain takes this shape and how
its flatness prices look-ahead. The [checkpoint stream](./game-simulation.md#checkpoint-streams)
covers the per-activity rows this chain spans.

## The chain row

`activity_chains`, keyed `(avatar_id, scope_type, scope_id)`, holds the chain's state as two
cursors.

- The **appended anchor** (`appended_next_seed`, `appended_chain_index`) is the derivation source: a
  new activity seeds from it. It moves the instant an activity's tail is written, ahead of
  verification, so offline play never waits on the verifier.
- The **verified anchor** (`verified_next_seed`, `verified_chain_index`) is the settlement watermark
  and the rollback target. Settlement trusts positions at or below it.

`genesis_seed` records the origin seed. The row carries no `updated_at` column and no on-update
trigger, so a reveal that self-assigns `genesis_seed` to keep the mint idempotent writes no logical
change and bumps no timestamp.

## Seeds and chainIndex

A seed is a 128-bit xoroshiro128+ state carried as a 32-character hex string. A continuation's seed
is the previous activity's final checkpoint `nextSeed`, copied verbatim — the derivation is
identity. The verifier reproduces the seed from the appended chain rather than trusting a submitted
value.

`chainIndex` counts checkpoints along the whole chain, monotonic across activities, so a failed
attempt's positions are spent, never reused. An activity carries `start_chain_index`, stamped at
start from the chain's appended anchor. A checkpoint's `chainIndex` is
`start_chain_index + version`, where `version` is its 1-based position in the activity's stream. The
`Started` checkpoint sits at `start_chain_index + 1`. Reward coordinates and sealed-salt positions
key on this value.

`chainIndex` sits in the checkpoint's frozen hashed subset, so replay reproduces every coordinate.
The server validates each checkpoint's `chainIndex` against `start_chain_index + version`.

## Genesis

A chain scope's genesis seed is a server CSPRNG (cryptographically secure PRNG) mint: sixteen random
bytes as hex, re-rolled off the degenerate all-zero xoroshiro state. `revealNodes` mints it at
reveal time, one chain row per revealed `(avatar, scope)` pair. A repeat reveal self-assigns the
row's own `genesis_seed`, so the mint stays idempotent under any number of concurrent callers. A
client cannot compute or steer the seed, because the scope and the avatar are both fixed before the
mint. The verifier reads the stored value and a restored device fetches it; neither re-derives it.

## Building a start

Every activity start is a local client synthesis. The worker builds the activity's full start row
from this device's cached inputs, without calling the service — interactive starts,
auto-continuations after a terminal checkpoint, and offline catch-up alike (see
[game simulation](./game-simulation.md#authoring-and-verifying-inputs)). The server authors no
start; it verifies the one the client submits.

`revealNodes` returns each node's current appended anchor — the chain row's `head`,
`{ nextSeed, chainIndex }` — alongside its genesis seed. A start begins from that anchor, so it
resumes where play on the node last left off rather than restarting from genesis. A node never yet
played has an anchor of `{ genesisSeed, 0 }`.

`revealNodes` also returns each node's `encounterNode`, the content version it was derived against,
the key version, the scope-secret ref, and the scope-secret version the derivation read. With the
sim version the client already holds, these are every input `buildStartHash` needs.

app-web calls `revealNodes` for every node the fog-of-war projection reveals and relays the seeds,
anchors, encounters, and stamps to the idle worker with the active avatar. The worker caches each
node's seed, anchor, encounter, and content version under its `[avatarID, nodeID]` key in the
`node-seeds` IndexedDB store, and the stamps in the `preferences` store. Every node the player can
see then carries what a start needs to synthesize a valid start row without the server.

The node key scopes a seed to its avatar. Two avatars sharing a coordinate hold distinct chains
against distinct seeds, so neither overwrites the other's cached value.

The checkpoint submitter writes each node's advancing appended anchor back to its cache row as the
client plays the chain forward. A later start at that node then begins from the position this device
has reached, not the reveal's original anchor.

### Ingesting a held start

Every synthesized start row is written to the durable `pending-roots` IndexedDB store, keyed by its
activity id, before it installs onto the live simulation. A crash between mint and install still
leaves a recoverable start.

`advanceActivity` ingests such a start when the caller reconnects with one still unsubmitted. The
client submits the `seed`, versions, `startChainIndex`, build snapshot, and start hash it computed
offline. The server re-derives the encounter and the key and secret stamps from its own content
document and scope secret rather than trusting the payload, then requires the client's start hash to
equal its own recompute. The anchor check is exact: the start's `startChainIndex` must equal
`appendedChainIndex` and its seed must equal `appendedNextSeed`, so a start computed against an
anchor the chain has since moved past is refused rather than layered onto a position that no longer
exists.

The client ingests each pending start into the server on first server contact. A `NOT_FOUND` answer
to a checkpoint flush triggers a one-shot ingest-and-retry of that same batch rather than an
immediate discard. A start orphaned by a worker reload — no live simulation left to drive its flush
— ingests on reconnect instead, ahead of the held-checkpoint flush it would otherwise `NOT_FOUND`
against. Either path removes the durable `pending-roots` entry once the server has answered
definitively. A server-refused start is dropped and its queued checkpoints discarded, the same as
any other stream the server refuses to recognize.

## Advancing the chain

The chain advances when an activity transitions out of `active`. Which cursor moves depends on
whether the appended tail is trustworthy.

### Forward exits

A terminal checkpoint (completed or failed), a user stop, and an offline cap all leave honest
progress. The request path advances `appended_next_seed` and `appended_chain_index` from the last
appended checkpoint, but only while the chain's anchor still matches the activity's
`start_chain_index`; a duplicate transition finds it already moved and writes nothing. An activity
that appended nothing leaves the anchor untouched, as does one whose only checkpoint is `Started`:
its `nextSeed` equals its seed, so nothing was consumed.

### Adverse exits

Reproducible divergence rejects a stream; repeated ambiguity quarantines it. The appended tail is
then suspect and never advances the appended anchor.

A rejection rewinds the appended anchor to the verified anchor in one self-referential statement,
setting `appended_next_seed = verified_next_seed` and `appended_chain_index = verified_chain_index`
from the row's own columns. A successor that already started past the verified anchor
(`start_chain_index > verified_chain_index`) is void: its forward-advance can no longer match the
anchor, and nothing further settles from it. Whatever it settled while verifying stands. A
quarantine blocks new activity starts on the pair. Every other chain scope proceeds.

Session eviction changes the writer, not the activity. The activity stays `active`, and a new
session resumes it from the verified anchor. The tail is adjudicated on its own merits. Eviction
advances nothing.

## Settlement and reward reveal

Identity settlement and rolled-reward reveal gate on verification, never on the appended anchor, so
nothing unproven is paid. A synced but unverified reward holds as a pending item on the client until
the verifier settles it.

Verification's unit is the **segment**: a stream is adjudicated in pieces as it arrives, and each
piece settles what it proved. A run stopped, capped, or held part way through keeps the XP its
verified prefix earned, and an item minted for a verified segment stays minted. A rejection voids
the chain's unverified remainder and every successor started past the verified anchor, but reverses
no payout already made.

The XP a checkpoint carries is read two ways. A non-terminal checkpoint's `rewards.xp` is that
checkpoint's own delta; a terminal checkpoint's is the run's final total, containing every delta
before it. A segment therefore settles either the sum of the deltas it verified or, when it ends on
a terminal, that total less what earlier segments already settled. The per-activity running total
moves in the same guarded update that advances the verified anchor, so the anchor and the amount can
never disagree.

### Building against unsettled XP

A consequential read — a new activity's `buildSnapshot`, or anything else feeding a new run —
includes an ended run's unsettled XP, so a player who finishes one run and immediately starts
another builds against what they just earned. A held run is excluded: `parked` and `quarantined`
reach verification only by operator action, so counting one would stamp XP into this run's snapshot,
and every later one, that never settles.

An activity records its **XP sources**: the earlier runs whose unsettled XP fed its build snapshot,
stored at start. A run that fed it nothing is left out. XP is the only quantity a build snapshot
draws ahead of verification — an item mints only for a verified segment — so adding a drawn quantity
to a snapshot is what extends its XP sources. Identity is avatar-global while chains are per-scope,
so an XP source can lie on another chain, and these sources are what order an avatar's chains
against each other.

The verifier settles an activity only after its XP sources, refusing to settle a chain ahead of the
runs it drew from:

- A chain cannot settle while any of its XP sources has appended past that source's own verified
  anchor. The sources are runs that had already ended when the dependent activity started, so the
  ordering is acyclic and holds transitively.
- A chain whose XP source rejected is refused without replaying its own stream, there being no
  proven total left to replay against. Its own dependents fail the same check in turn, so one
  rejection reaches every dependent through the single-chain rejection path.
- An XP source under an operator hold keeps its dependents waiting, since a hold that later rejects
  would leave the same unproven total in place. The dependent chain stalls until the hold clears.
- A dependent still running when its source is rejected is refused at its next adjudication, since a
  chain is inspected only when it has appends to verify.

### The progression read

`getAvatarProgression` reads the settled row, its pending projection, and the live run's
settled-so-far in a single statement, so a client display is never torn between them. The pending
projection holds one entry per ended-but-unsettled activity, computed as the inverse of what
verification settles: a settlement moves a delta from the pending set into the settled row without
changing their sum, and a build snapshot stamped from the settled row plus the unsettled XP it draws
matches what verification pays. The pending projection itself is display-only.

## Concurrency

- The verifier serializes a chain's activities on the chain row, adjudicating one at a time in
  order, so a continuation never confirms against a predecessor that later rejects.
- A chain waits on its XP sources to settle, ordering an avatar's chains against each other while no
  writer holds more than the one chain row it claimed.
- The request-path forward-advance and the verifier both take the chain row before the activity row,
  one ordering that admits no cycle.
- The rejection rewind reads the verified columns inline in its update statement, never through a
  prior select, so a concurrent confirm cannot slip between the read and the write.

## Glossary

| Term            | Meaning                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| seed chain      | One forward, append-only sequence of seeds per `(avatar, chain scope)` pair; each activity draws one and advances it.                         |
| chain scope     | A `(scope_type, scope_id)` pair naming a stable, returnable target; a world-map node is the `world_map_node` scope.                           |
| chain row       | The `activity_chains` row holding a chain's genesis seed and its two anchors.                                                                 |
| appended anchor | `(appended_next_seed, appended_chain_index)`: the position a new activity seeds from; moves ahead of verification.                            |
| verified anchor | `(verified_next_seed, verified_chain_index)`: the settlement watermark and rollback target; moves only on trust.                              |
| genesis seed    | A scope's origin seed, CSPRNG-minted at reveal, from which the chain's first activity derives.                                                |
| chainIndex      | A checkpoint's position along the whole chain, `start_chain_index + version`; reward coordinates key on it.                                   |
| activity start  | An activity's first record — node, seed, and stamps — synthesized locally by the client and verified on ingest.                               |
| continuation    | An activity that seeds from a prior attempt's appended position, continuing the same chain.                                                   |
| segment         | The run of checkpoints the verifier adjudicates as one piece; each segment settles what it proved.                                            |
| XP sources      | The earlier runs whose unsettled XP fed an activity's build snapshot, stored at its start; the verifier settles the activity only after them. |
