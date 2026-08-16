# Game simulation & verification

How the client computes and records gameplay, and how server replay decides to trust it.

The client runs every real-time simulation as a pure function of a fixed set of inputs and a seeded
random stream, writing each step to an append-only checkpoint stream. The server never simulates on
the request path: a queue-fed verifier re-runs the submitted checkpoints later and decides whether
to trust them. Determinism is what makes that possible: the same inputs re-run to byte-identical
results. That reproducibility is what lets the verifier check a stream it did not compute, and what
lets a returning client rebuild simulation state it no longer holds.

This page owns the simulation, the checkpoint stream, and the trust decision. The reconcile that
delivers offline progress on reconnect, and the worker lifecycle that drives it, live in
[offline reconcile](./offline-reconcile.md).

## Activities and encounters

An **activity** is one attempt at a piece of content, recorded as a single append-only checkpoint
stream and verified as a unit. Every activity has a type. A **world-map encounter** is the type
where an avatar fights through a map node's enemies, arranged in **waves** — ordered enemy groups
the avatar clears one at a time. Each activity type supplies an `ActivityExecutor` that advances its
simulation. **Combat** is how a world-map encounter resolves: each tick, its executor advances the
avatar and the current wave's enemies and dispatches their attack events.

`@vers/idle-core` runs any activity type. `@vers/game-utils` derives a world-map encounter's waves,
enemies, and timing from `(node, seed, content)` as a pure function.

Activities at the same target chain together: each `(avatar, chain scope)` pair owns one append-only
[seed chain](./seed-chain.md). A **chain scope** is a stable, returnable target — a world-map
encounter's scope is its map node (`world_map_node`). The activity type says what the avatar does;
the scope type says where it returns to.

## The deterministic core

The simulation is a pure function: a fixed set of inputs plus a seeded random stream fully determine
every tick. Both the client and the server run it from the same shared libraries (`@vers/idle-core`,
`@vers/game-utils`), so they compute byte-identical results from identical inputs.

Purity rests on three invariants:

- **Every random draw comes from the seeded stream.** No draw reads `Math.random` or a wall clock.
- **Every entity id derives from its position in the input.** An enemy's id comes from its wave
  index and its slot within the wave, never from a randomly minted value.
- **Combat events resolve into one total order.** Events sort by ascending event time. Two rules
  break a tie at an equal timestamp: the avatar's own events come first; then the monotonic sequence
  number the executor stamps on each event as it schedules it. The order never depends on an event
  id or on the scan order that discovered the event that tick.

The client does all real-time simulation. One writer per browser profile runs the fixed-timestep
loop; every other tab is a viewer that renders the writer's **sim snapshot**, the engine's
serializable projection from `getSnapshot()`. The sim snapshot is distinct from the **build
snapshot**, the avatar's equipment, passives, and level pinned as a simulation input.

### Writer election

The writer worker is a SharedWorker where the browser has one. Where it does not — Android Chrome,
older Safari — every tab spawns a dedicated worker, and the workers race one exclusive Web Locks
request for the writer lock. The winner boots the worker runtime and announces itself with a
writer-ready broadcast. It reaches every tab over a pair of BroadcastChannels, one for each
direction. The inbound and outbound channels are separate, so a tab never receives a message another
tab sent.

The granted-lock callback never settles, so the browser releases the lock only when the writer's tab
dies. The next queued worker then boots exactly as a reloaded worker does, seeding from the same
durable stores a reload reads — its queued checkpoints and its pending-roots store. A frozen
background tab holds the lock while paused: the writer stalls until the tab thaws or the browser
discards it, and the offline reconcile absorbs the stall by reconstructing the gap on the next
reconnect.

The worker lifecycle — the states the writer moves through and how a handoff moves work to a fresh
worker — lives in [offline reconcile](./offline-reconcile.md#worker-lifecycle).

## Authoring and verifying inputs

The client authors every activity input; the server verifies it. Starting an activity is one
unconditional local synthesis: the client mints the **activity start** — its first record, naming
the node, seed, and content and version stamps — from materials it cached at reveal, and drops into
the simulation with no server round trip. The same synthesis covers every start, whether it is the
player tapping a node, an auto-continuation after a terminal checkpoint, or an offline gap caught up
on reconnect. The server authors no start on the request path.

The client anchors each start at the chain's current head, which `revealNodes` delivers alongside
the seed (see [seed chain](./seed-chain.md)). It persists the synthesized start to the durable
pending-roots store before installing it, so a crash between mint and install loses nothing. It
queues the activity's checkpoints through the durable checkpoint submitter, which lands them
whenever the server is next reachable.

`advanceActivity` is the server's authority over a client-authored start. It re-derives every
authoritative input from its own truth and trusts none of the payload:

- It runs the same sim-version admission check an online start does. It does not check node
  reachability at admission: an offline gap can legitimately reach a neighbour whose opening clear
  the server has not yet verified, so [replay](#replay) adjudicates reachability instead.
- It derives the encounter node and its hashed stamps from the server's own content document, never
  the payload.
- It re-authors the `buildSnapshot` from the avatar's progression, and rejects a start whose
  predicted snapshot does not match.
- It recomputes the `startHash` from the server-derived encounter and stamps, and requires the
  submitted hash to equal it. The match proves the client simulated against the same content and
  encounter the server derives.
- It validates the submitted `seed` and `startChainIndex` against the chain's live appended anchor,
  and refuses a start computed against a position the chain has moved past.

A single `advanceActivity` request carries a whole chain of continuations, so an offline gap the
client simulated locally verifies in one round trip. Every continuation reuses the start's seed
chain and its pinned encounter and version context, and the server re-derives each continuation's
build the same way it re-derives the start's. The stored activity row carries the same columns
whichever path delivered it, so the replay verifier reproduces it unchanged.

### What replay pins

The `Started` checkpoint pins every input a replay needs: the sim and content versions, the roll
`keyVersion` ([game entropy](./game-entropy.md#version-pinning)), and `start_chain_index`
([seed chain](./seed-chain.md#seeds-and-chainindex)). Each later segment — a run of checkpoints
under one sim version — replays under the code and content its stamps name.

The activity's own id carries no cryptographic role. Its `startHash` digests only
`[seed, simVersion, contentVersion, keyVersion, encounterNode]`, because that tuple already
identifies the stream uniquely. A checkpoint's `version` — its position in the stream — and its link
to the previous checkpoint's hash, never the activity id, keep one activity's checkpoints from
crossing into another's. The id is a client-assigned label: `advanceActivity`'s caller mints each
continuation's id itself, so the client can compute a whole fast-forward chain with no per-row round
trip.

A node's encounter parameters are fixed at the content version the start pins and freeze onto the
start row, inherited unchanged by every continuation in the same request. They fold into the
`startHash`, so a later content change cannot alter an activity already in flight.

The server gates build mutations while an activity is active: a level-up renders optimistically and
applies between activities. A build snapshot that cannot change mid-activity is what makes a replay
exact.

## Checkpoint streams

Each activity is one append-only stream: one checkpoint row per step, keyed
`(activity_id, version)`, where `version` is the row's position in the stream. A single **head row**
carries the stream's two cursors, its last chain hash, and the activity status. `appended_head`
tracks how far the client has written; `verified_head` tracks how far the verifier has trusted.

- **Each checkpoint links the last.** A checkpoint hashes a frozen set of fields: its position in
  the chain, its seed and next seed, and its `time`, `type`, and `entropySource`. It also includes
  the previous checkpoint's hash. The set never gains, loses, or repurposes a field. Its chain
  position sits inside the hash, so replay reproduces every reward coordinate keyed on it
  ([seed chain](./seed-chain.md)), and its entropy-source tag makes a checkpoint's provenance
  derivable from the chain alone.
- **The hash is a chain link, not an outcome proof.** Rewards ride outside the hashed set as `+`/`-`
  deltas in an open keyed map, and only a replay validates them.
- **An append is a guarded update of the head row.** The append advances `appended_head` only if the
  head still holds its expected value; a stale head returns a retryable conflict carrying the
  current head, and the client resends the tail. Resubmission deduplicates for free —
  `UNIQUE(activity_id, version)` plus deterministic checkpoint content — and dedupe runs before
  elapsed-time accounting, so a replayed tail never inflates duration.
- **Each activity has one writer.** The head row stamps the session allowed to append, and resuming
  on a new session takes the writer over. An append from any other session fails fatally, so a
  displaced writer's in-flight submissions die rather than interleave. A terminal status — stopped,
  rejected, capped, quarantined — rejects any later append. Together these resolve every race
  between logout, forced logout, stop, rejection, and cap.

## Replay

A queue-fed verifier replays submitted checkpoint batches and compares its results against the
stream. Replay is per-stream FIFO: `version` N+1 never verifies before N, because the seed chain
would break. The verifier replays from the `Started` checkpoint under the sim version stamped into
it, dispatched through a provider registry keyed by sim version so an old segment replays under the
code and content that produced it. For the sim version this deploy runs, the verifier holds each
live stream's simulation in memory at its verified head and advances it by each batch's delta rather
than replaying from `Started` every time; a verifier restart or cache eviction falls back to a
from-`Started` rebuild.

The verifier parks an ambiguous stream rather than rejecting it. A sim-version mismatch, an unknown
engine, or a timeout is held as an operational state, not judged as a cheat signal. Only
reproducible divergence under a matched sim version and `Started` checkpoint, on repetition, is
treated as cheating. Enforcement lands at a session boundary, never mid-session. The verifier
quarantines a stream that fails replay repeatedly and alerts operators rather than retrying it
forever.

Replay also checks reachability. On a run's first verified pass at a world-map node, the verifier
confirms the node borders a node the avatar has already cleared; the origin always counts as
reachable. A node with no cleared neighbour is rejected. Activities settle in play order
([offline reconcile](./offline-reconcile.md#settlement-in-order)), so the clear that opened an
honest node has settled by the time its successor is checked and its grant is present. An unearned
jump reaches a node no clear opened, so the verifier finds no grant and refuses it.

Replay divergence is not the only cheat signal. Because every attempt at a node is a link in the
append-only, server-verified chain, **reroll-scanning** — repeatedly attempting a node and
discarding the unfavorable results to keep a favorable roll — leaves a record. An avatar whose
results ride the favorable tail of its own verified history stands out from honest play: faster
clears and better positions, more often than the distribution predicts. The record catches it
whether it reached those results by failing attempts or by completing and discarding them. This is a
behavioural signal, not a divergence, and it is scored with the same restraint: a soft consequence
before a hard one, always at a session boundary. Honest grinders swing too, and a false accusation
costs more than the edge it denies.

Operators watch the verifier through its metrics: replay lag and rejection rates split by cause
([observability](../platform/observability.md)). An integrity-mismatch spike there is investigated
as a deploy regression first, not a cheating wave.

An old sim version stays a valid replay target for a retention window of ~30 days
([deployment](../platform/deployment.md#retention-sweep)) before the sweep tombstones it.

## Applying verified progress

Verified progress applies exactly once through a cursor-guarded transaction. The transaction
advances `verified_head` only if it still holds its expected value, then writes the newly verified
progress to the avatar's identity state and appends the settlement's economic-ledger entry — all in
one local transaction. A crash mid-apply retries the transaction idempotently.

- **One-shot grants insert idempotently.** First-clears, achievements, and other one-time grants
  insert into a unique-keyed grant table with `ON CONFLICT DO NOTHING` inside the same transaction,
  so they hold across re-farms and replays.
- **Item instances mint at settlement.** An item's identity is its reward coordinate, and its
  content is rolled from the avatar's key under the activity's pinned versions (see
  [game entropy](./game-entropy.md)). Re-verification never duplicates or re-rolls an item.
- **A reward stays hidden until it is verified.** The read path that returns a coordinate's rolled
  reward for display answers only for a chain position the verifier has confirmed, never one only
  appended ([seed chain](./seed-chain.md)); a reward that has synced but not yet verified holds on
  the client as pending until settlement. That read is a pure function of the coordinate, so an
  append retry or a bulk offline resend returns the same reward every time.
- **A rejected activity rolls back by compensating forward, never by restoring a prior database
  state.** Settlement returns the node to its last verified checkpoint, and any reward revealed past
  that point but not yet settled clears from the optimistic display.

When play resumes, the client rebuilds its own optimistic state by simulating forward from the
verified head. It never reads the server's settled progression columns directly, because those
columns lag verification by design. The order the server settles reconciled activities in — and why
a later activity waits on an earlier one — lives in
[offline reconcile](./offline-reconcile.md#settlement-in-order).

## The offline budget

Offline progress is bounded by a per-avatar simulated-time meter, enforced on the append path. The
budget refills at wall-clock rate since it was last banked, never past the cap
(`OFFLINE_PROGRESS_CAP_MS`, 24h). Every accepted checkpoint batch debits its simulated-time delta:
the last checkpoint's cumulative `time` minus the head row's accounted time, never a sum of the
batch's per-checkpoint times.

Because the only credit source is elapsed wall clock, no path earns simulated time faster than real
time — not activity cycling, not stop/start, not avatar rotation. Live play self-funds: each flush
banks roughly the wall clock it consumes. A small initial grant on the meter absorbs tick-boundary
and network jitter.

A batch whose delta exceeds the accrued budget is rejected whole, and the activity takes the
terminal `capped` transition at its current head. The `ACTIVITY_CAPPED` error carries that head as
the exact index the client rebases its chain cursor from, and resuming requires a resync. An honest
client never trips the cap: it plans its catch-up simulation to stop at the last encounter boundary
at or under the same bound.

Which rewards an offline simulation may produce is an economy rule, not a protocol one: the
[economy modes note](../../game-design/economy-modes.md) owns it. How a reconnect delivers and
settles the offline gap is the subject of [offline reconcile](./offline-reconcile.md).

## Glossary

| Term                | Meaning                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| activity            | One attempt at one piece of content, recorded as a single append-only checkpoint stream and verified as a unit.                          |
| activity type       | What the avatar does in an activity; supplies the `ActivityExecutor` that advances its simulation.                                       |
| world-map encounter | The activity type where an avatar fights through a map node's enemies, arranged in waves.                                                |
| chain scope         | The stable, returnable target activities chain against; a world-map encounter's scope is its map node.                                   |
| activity start      | An activity's first record — the node, seed, and stamps — synthesized locally by the client and verified by the server on ingest.        |
| continuation        | An activity that resumes a chain scope from a prior attempt's appended position, in the same chain.                                      |
| settle              | The server's verified application of an activity's rewards to durable state; the moment provisional progress becomes real.               |
| build snapshot      | The avatar's equipment, passives, and level pinned as a simulation input; the client predicts it, the server re-derives and verifies it. |
| sim snapshot        | The engine's serializable projection from `getSnapshot()`, which viewer tabs render.                                                     |
| writer worker       | The one worker per browser profile that runs the simulation and appends its checkpoints.                                                 |
| verifier            | The server process that replays a submitted stream to decide whether to trust it.                                                        |
| checkpoint          | One recorded simulation step: a row keyed `(activity_id, version)` that links the previous checkpoint's hash.                            |
| head row            | An activity's single row carrying its two cursors, last chain hash, writer session, and status.                                          |
| appended head       | `appended_head`: how far the client has written the stream.                                                                              |
| verified head       | `verified_head`: how far the verifier has replayed and trusted the stream.                                                               |
| sim version         | The engine build's version stamp (`simVersion`); pins which code replays a segment.                                                      |
| offline budget      | The per-avatar simulated-time meter, refilled at wall-clock rate and debited per accepted batch.                                         |
