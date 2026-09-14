# Game simulation

The client computes and records all gameplay, and the server decides by replay whether to trust it.
The client runs every real-time simulation as a pure function of a fixed set of inputs and a seeded
random stream, and writes each step to an append-only checkpoint stream. The server never simulates
on the request path. The same inputs re-run to byte-identical results, which lets a verifier check a
stream it did not compute and lets a returning client rebuild simulation state it no longer holds.
[Replay verification](./replay-verification.md) owns the verifier and settlement, the
[seed chain](./seed-chain.md) owns where an activity's randomness comes from, and
[offline reconcile](./offline-reconcile.md) owns the delivery of offline progress on reconnect. The
[glossary](./glossary.md) defines the terms these docs share.

A checkpoint's path from the writer to settled progress:

```mermaid
flowchart LR
  W["writer worker<br>simulates, appends checkpoints"] -->|checkpoint batches| A["activity service<br>appends the stream, moves the appended head"]
  A -->|wake| Q["replay queue<br>claims one activity per avatar in play order"]
  Q --> V["verifier<br>replays the segment under its pinned sim version"]
  V -->|match| S["settlement<br>moves the verified head, pays XP and items"]
  V -->|reproducible divergence| R["rejection<br>rewinds the appended anchor"]
  V -->|cannot replay yet| P["parked or quarantined<br>waits for an operator"]
```

## Activities and encounters

Combat is how a world-map encounter resolves: each tick, the activity type's executor advances the
avatar and the current wave's enemies and dispatches their attack events. The idle engine runs any
activity type, and the shared game library derives a world-map encounter's waves, enemies, and
timing from the node, the seed, and the content as a pure function. Activities at the same chain
scope chain together, each pair of avatar and scope owning one seed chain.

## The deterministic core

Purity rests on three invariants:

- Every random draw comes from the seeded stream. No draw reads a system random source or a wall
  clock.
- Every entity id derives from its position in the input. An enemy's id comes from its wave index
  and its slot in the wave, never from a minted random value.
- Combat events resolve into one total order. Events sort by event time. At an equal time the
  avatar's own events come first, then the sequence number the executor stamped when it scheduled
  each event.

One writer worker per browser profile runs the fixed-timestep loop
([worker lifecycle](./offline-reconcile.md#worker-lifecycle)). Every other tab is a viewer that
renders the writer's sim snapshot.

## Authoring an activity start

The client authors every activity input, and the server verifies it. To start an activity, the
client builds the activity start from the materials it cached at node reveal and drops into the
simulation with no server round trip. The same local build covers a tap on a node, an
auto-continuation after a terminal checkpoint, and an offline gap caught up on reconnect. The client
persists the start to a durable store before it installs it, so a crash between building and
installing loses nothing, and it queues the activity's checkpoints through a durable submitter that
lands them whenever the server is next reachable.

The server admits a client-authored start by re-deriving every authoritative input from its own
truth. It trusts none of the payload:

- It runs the sim-version admission check
  ([sim-version registry](./replay-verification.md#sim-version-registry)).
- It derives the encounter node and its hashed stamps from its own content document.
- It re-authors the build snapshot from the avatar's progression
  ([building against unsettled XP](./seed-chain.md#building-against-unsettled-xp)) and rejects a
  start whose predicted snapshot differs.
- It recomputes the start hash from the server-derived encounter and stamps and requires the
  submitted hash to equal it. The match proves the client simulated against the content and
  encounter the server derives.
- It checks the submitted seed and start index against the seed chain's live appended anchor
  ([seed chain](./seed-chain.md#handing-an-activity-start-to-the-server)).

Admission checks no node reachability; replay adjudicates it, because an offline gap can
legitimately reach a neighbour whose opening clear is still unverified. One admission request
carries a whole run of continuations, so an offline gap the client simulated locally verifies in one
round trip.

## What replay pins

The `Started` checkpoint, the activity's first checkpoint row, pins every input a replay needs: the
sim and content versions, the key version ([game entropy](./game-entropy.md#version-pinning)), and
the chain index the activity started from ([seed chain](./seed-chain.md#positions-on-the-chain)).
The activity's id is a client-assigned label with no cryptographic role, which is what lets the
client compute a whole fast-forward run with no per-row round trip.

A node's encounter parameters are fixed at the content version the start pins and freeze onto the
start row, and every continuation in the same request inherits them. They fold into the start hash,
so a later content change cannot alter an activity in flight. The server also gates build mutations
while an activity is active: a level-up renders optimistically and applies between activities.

## Checkpoint streams

Each activity is one append-only stream: one checkpoint row per step, keyed by the activity id and
the row's position in the stream. A single head row carries the stream's two cursors, its last
checkpoint hash, and the activity status. The appended head tracks how far the client has written;
the verified head tracks how far the verifier has trusted.

- Each checkpoint links the last. A checkpoint hashes a frozen set of fields that never gains,
  loses, or repurposes a member, and the set includes the previous checkpoint's hash. The chain
  position sits inside the hash, so replay reproduces every reward coordinate keyed on it, and the
  entropy-source tag makes a checkpoint's provenance derivable from the stream alone.
- The hash links, it does not prove. The stream carries rewards outside the hashed set, so the hash
  proves nothing about them. Only a replay validates a reward.
- An append is a guarded update of the head row. The append advances the appended head only if the
  head still holds its expected value. A stale head returns a retryable conflict carrying the
  current head, and the client resends the tail. A resend deduplicates on the activity-and-position
  key, because checkpoint content is deterministic. Dedupe runs before elapsed-time accounting, so a
  replayed tail never inflates duration.
- Each activity has one writer. The head row stamps the session allowed to append, and resuming on a
  new session takes the writer over. Writer ownership is per activity, never per account; the
  account's single verified session is a separate rule
  ([auth](../services/auth.md#session-lifecycle)). An append from any other session fails, so a
  displaced writer's in-flight submissions die rather than interleave. A terminal status rejects any
  later append.

## The offline budget

A per-avatar simulated-time meter bounds offline progress, and the append path enforces it. The
meter refills at wall-clock rate since it was last banked, never past its cap. Every accepted
checkpoint batch debits its simulated-time delta: the last checkpoint's cumulative time minus the
head row's accounted time, never a sum of per-checkpoint times. Elapsed wall clock is the only
credit source, so no path earns simulated time faster than real time. Live play self-funds, since
each flush banks about the wall clock it consumed, and an initial grant absorbs tick-boundary and
network jitter. One exception: a QA avatar's meter refills at a multiple of wall clock
([manual QA](../../runbooks/qa.md#debug-hook)).

A batch whose delta exceeds the accrued budget is rejected whole, and the activity takes the
terminal `capped` transition at its current head. The `ACTIVITY_CAPPED` error carries that head as
the index the client rebases its stream cursor from, and resuming needs a resync. Which rewards an
offline simulation may produce is an economy rule the
[economy modes note](../../game-design/economy-modes.md) owns.
