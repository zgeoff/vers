# Game simulation & verification

How gameplay is computed on the client, recorded as checkpoint streams, and trusted through server
replay.

The client runs all real-time simulation as a pure function of server-authored inputs and a seed
stream, writing each step to an append-only checkpoint stream. The server never simulates on the
request path: a queue-fed verifier replays submitted checkpoints asynchronously and decides whether
to trust them. Determinism is the distinction that governs everything else — the same inputs replay
to byte-identical results, and that reproducibility is what makes both verification and offline
catch-up exact.

## Activities and encounters

An **activity** is one attempt at a piece of content, recorded as a single append-only checkpoint
stream and verified as a unit. Every activity has a type. A **world map encounter** is the type
where an avatar fights through a map node's enemies, arranged in **waves** — ordered groups the
avatar clears one at a time. Each activity type supplies an `ActivityExecutor` that advances its
simulation. **Combat** is how an encounter resolves: each tick, the world map encounter's executor
advances the avatar and the current wave's enemies and dispatches their attack events.
`@vers/idle-core` runs any activity type. `@vers/game-utils` derives a world map encounter's waves,
enemies, and timing from `(node, seed, content)` as a pure function.

Activities at the same target chain together: each `(avatar, chain scope)` pair owns one append-only
[seed chain](./seed-chain.md). A **chain scope** is a stable, returnable target — a world map
encounter's is its map node (`world_map_node`) — and the seed chain owns its model. The activity
type says what the avatar does; the scope type says where it returns to.

## The deterministic core

The simulation is a pure function: a server-authored input snapshot plus a seed stream fully
determine every tick. The engine `@vers/idle-core` and world map encounter derivation
`@vers/game-utils` are shared libraries. Both the client worker and the verifier — the server
process that replays submitted checkpoints — import them and compute byte-identical results from the
same inputs.

The client does all real-time simulation. One writer per browser profile runs the fixed-timestep
loop: a SharedWorker, with leader election where SharedWorker is unavailable. Other tabs are pure
viewers. Viewer tabs render the writer's **sim snapshot**: the engine's serializable `*Snapshot`
projection from `getSnapshot()`. That snapshot is separate from the server-authored **build
snapshot**, which pins an avatar's build as a simulation input. On returning from offline, the
client fast-forwards the simulation from the last verified checkpoint. The server never simulates on
the request path. It replays asynchronously to decide whether to trust what the client submitted.

## Server-authored inputs

`startActivity` is a server action that owns every simulation input. For each start it:

- mints the seed for a node's first activity, and derives each continuation's seed from the previous
  activity's appended checkpoint (see [the seed chain](./seed-chain.md))
- resolves the node's enemy content
- snapshots the avatar's build (equipment, passives, level) from server truth
- stamps the engine and content versions

The `Started` snapshot pins every version a replay needs — the engine and content versions, the roll
`keyVersion` ([game entropy](./game-entropy.md#version-pinning)), and `start_chain_index`
([seed chain](./seed-chain.md#seeds-and-chainindex)) — so replay resolves each under the code that
produced it.

Client-submitted activity and avatar payloads are display hints. A continuation's seed is a client
computation the verifier reproduces from the appended chain — online and offline alike, never a
round-tripped value taken on trust. The scope node's encounter params resolve server-side and freeze
onto the activity row at start. They fold into the start hash, so a later content change can't
retroactively alter an activity already in flight.

Build mutations are gated while an activity is active: level-ups render optimistically and apply
between activities. A snapshot that cannot change mid-activity is what makes replay exact.

## Checkpoint streams

Each activity is one append-only stream: one checkpoint row per version, keyed
`(activity_id, version)`, plus a head row. The head row carries the stream's two cursors, its last
chain hash, and the activity status. `appended_head` tracks how far the client has written;
`verified_head` how far the server has replayed.

- Each checkpoint hashes `{seed/nextSeed, time, type, entropySource}` and links the previous
  checkpoint's hash. The hashed subset is frozen from the first row ever written: it never gains,
  loses, or repurposes a field. The entropy-source tag inside it makes a checkpoint's provenance
  derivable from the chain itself.
- The hash is a chain link, not an outcome proof. Rewards ride outside the hashed subset as signed
  deltas in an open keyed map, and only replay validates them.
- Appends compare-and-swap the head row's `appended_head`. A stale head returns a retryable conflict
  carrying the current head, and the client resends the tail. Resubmission is a free dedupe:
  `UNIQUE(activity_id, version)` plus deterministic checkpoint content. Dedupe runs before
  elapsed-time accounting, so replays never inflate duration.
- Each activity has a single writer: the head row stamps the session allowed to append, and resuming
  on a new session takes the writer over. An append from any other session fails fatally, so a
  displaced writer's in-flight submissions die rather than interleave. Terminal statuses (stopped,
  rejected, capped, quarantined) reject any later append. Together these resolve every race between
  logout, forced logout, stop, rejection, and cap.

## Replay

A queue-fed verifier replays submitted checkpoint batches and compares results. Replay is per-stream
FIFO: version N+1 never verifies before N, because the seed chain would break. The verifier replays
from the `Started` snapshot under the engine version stamped into it, dispatched through a provider
registry so old segments replay under the code and content that produced them. For the engine
version this deploy runs, the worker holds each live stream's simulation in memory at its verified
head and advances it by each new batch's delta rather than replaying from `Started` every time. A
worker restart or cache eviction falls back to a from-`Started` rebuild.

Ambiguity parks, it never rejects: a version mismatch, an unknown engine, or a timeout is held as an
operational state, not judged as a cheat signal. Only reproducible divergence under a matched
version and snapshot, on repetition, is treated as cheating. Enforcement lands at a session
boundary, never mid-session. A stream that fails replay repeatedly is quarantined and alerted on
rather than retried forever.

Replay divergence is not the only cheat signal. Because every attempt at a node is a link in the
append-only, server-verified chain, reroll-scanning leaves a record. An avatar whose results ride
the favorable tail of its own verified history stands out from honest play — faster clears, better
positions, more often than the distribution predicts. The record catches it whether it reached those
results by failing attempts or by completing and discarding them. This is a behavioural signal, not
a divergence. It is scored with the same restraint: a soft consequence before a hard one, always at
a session boundary. Honest grinders swing too, and a false accusation costs more than the edge it
denies.

Operating the verifier is an observability task: replay lag and rejection rates split by cause are
the verification metrics ([observability](../platform/observability.md)). An integrity-mismatch
spike there is almost always a bad deploy, not a cheating wave.

An old sim version stays a valid replay target for a retention window (~30 days,
[deployment](../platform/deployment.md#retention-sweep)) before the sweep tombstones it.

## Applying verified progress

Verified deltas apply exactly once through a cursor-guarded transaction. It advances `verified_head`
with a compare-and-swap — the update applies only if the cursor still holds its expected value —
then applies the delta to identity state and appends the settlement's economic-ledger entry, all in
one local transaction. A crashed worker retries idempotently.

- First-clears, achievements, and other one-shot grants insert into a unique-keyed grant table with
  `ON CONFLICT DO NOTHING` inside the same transaction — idempotent across re-farms and replays.
- Item instances mint at settlement: identity is the reward coordinate, and content is rolled from
  the avatar's key under the activity's pinned versions (see [game entropy](./game-entropy.md)).
  Re-verification never duplicates or re-rolls an item.
- The reveal read path returns a coordinate's content only at or below the verified anchor, never
  the appended head ([seed chain](./seed-chain.md)); a synced-but-unverified roll holds client-side
  as pending until settlement. The reveal is a pure function of the coordinate, so append retries
  and bulk offline resends return identical reveals.
- A rejected claim rolls back by forward compensating events, never by snapshot restore: settlement
  resets to the node's verified prefix, and revealed-but-unsettled rewards past it are cleared from
  optimistic display.

Resume always anchors on the last verified checkpoint. The client rebuilds optimistic state by
simulating forward from that anchor. It never renders the server's settled progression columns
directly, because they lag verification by design.

## Activity lifecycle

The SharedWorker owns every lifecycle transition — start, stop, continuation, resync. A tab
expresses intent in one message and correlates the worker's broadcast outcome by request id; no tab
calls the activity service for lifecycle work itself, so the tabs and the worker can never disagree
about which run exists.

- A start intent carries a request id the worker passes as the row's idempotency key (`start_key`).
  A duplicate delivery of the same start — a retry after a transport failure, a pending continuation
  honored later — converges on the row the first attempt minted, while a distinct intent into the
  same scope conflicts. Start flows run one at a time in the worker; a superseded flow abandons its
  work, and any row it minted is recovered by the fresher flow.
- A stop halts the local simulation immediately and needs no network. Delivery is a durable intent:
  earned checkpoints flush first, then a targeted, idempotent server stop lands, retried at every
  reconnect and resync entry until the row reads closed. An undelivered stop gates resync planning,
  so a catch-up never revives a run the player ended.
- Every install path re-checks a stop epoch after each await, so an in-flight resync or continuation
  abandons its install when a stop landed meanwhile.

## Offline progress

Four processes move simulation results around, each with one name:

- **Replay** is the verifier's asynchronous re-execution of submitted checkpoints: the trust
  decision, and nothing else.
- A **resync** is the client's confirmed-state fetch (verified anchor, appended head, server time)
  and the decision it drives.
- A **fast-forward** is the client's catch-up simulation of an offline gap, run on return.
- **Reconstruction** re-runs an activity from its seed to rebuild simulation state the client no
  longer holds. Determinism makes the result identical to the lost original, and the
  already-accepted prefix costs nothing against the budget.

### Resync and reconstruction

A resync executes in the SharedWorker, since only the worker holds the one live simulation a plan
might attach to. A tab triggers it with the avatar id alone, and the worker derives everything else
from the confirmed activity row. A negligible gap attaches to the live simulation directly.
Reconstruction recovers the submission cursor — the chain-link hash and seed the next checkpoint
continues from — by replaying up to the confirmed head, before the worker resumes ticking from
there. A larger gap fast-forwards through one or more attempts first, then attaches the same way to
whichever continuation is still active when the budget runs out.

A continuation the worker couldn't complete — a same-row race just after a terminal checkpoint, or a
transport failure starting the next row — is held as a durable start intent. Intents deliver before
a resync fetches its snapshot, so the row an intent mints is already in the snapshot and attaches
like any other active row; delivery is idempotent through the intent's start key, and a claim
another device raced in moots the intent. A player stop clears any held intent, so a stopped
activity is never resumed.

### The offline budget

Offline progress is bounded by a per-avatar simulated-time meter, enforced on the append path. The
budget refills at wall-clock rate since it was last banked, never past the cap
(`OFFLINE_PROGRESS_CAP_MS`, 24h). Every accepted checkpoint batch debits its simulated-time delta:
the last checkpoint's cumulative `time` minus the head row's accounted time, never a sum of the
batch's per-checkpoint times. Because the only credit source is elapsed wall clock, no path earns
simulated time faster than real time — not activity cycling, stop/start, or avatar rotation. Live
play self-funds: each flush banks roughly the wall clock it consumes. A small initial grant on the
meter absorbs tick-boundary and network jitter.

A batch whose delta exceeds the accrued budget is rejected whole, and the activity claims the
terminal `capped` transition at its current head. The `ACTIVITY_CAPPED` error carries that head as
the exact stop index the client rebases its chain cursor from, and resuming requires a resync. An
honest client never trips the cap: it plans its catch-up simulation to stop at the last encounter
boundary at or under the same bound. `getLatestActivityProgress` returns the database's current time
beside the resume cursors, so the client computes its offline gap against the clock that meters it.
The fast-forward simulates from the last verified anchor. Re-simulating a few already-submitted
minutes is harmless: the results are deterministic and resubmission dedupes.

Which rewards offline simulation may produce is an economy rule, not a protocol one: the
[economy modes note](../../game-design/economy-modes.md) owns it.
