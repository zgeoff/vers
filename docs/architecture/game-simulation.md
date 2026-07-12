# Game simulation & verification

How gameplay is computed on the client, recorded as checkpoint streams, and trusted through server
replay.

## The deterministic core

The simulation is a pure function: a server-authored input snapshot plus a seed stream fully
determine every tick. The engine (`@vers/idle-core`) and encounter derivation (`@vers/game-utils`)
are shared libraries, so the client worker and the verification worker — the server process that
replays submitted checkpoints — import the same code and compute byte-identical results from the
same inputs.

The client does all real-time simulation. One writer per browser profile runs the fixed-timestep
loop — a SharedWorker, with leader election where SharedWorker is unavailable — and other tabs are
pure viewers. On returning from offline, the client fast-forwards the simulation from the last
verified checkpoint. The server never simulates on the request path; it replays asynchronously to
decide whether to trust what the client submitted.

## Server-authored inputs

`startActivity` is a server action that owns every simulation input: it mints the seed (see
[game entropy](./game-entropy.md)), resolves the node's enemy content, snapshots the avatar's build
(equipment, passives, level) from server truth, and stamps the engine and content versions.
Client-submitted activity and avatar payloads are display hints — the verifier replays from the
snapshot, never from round-tripped values.

Build mutations are gated while an activity is active: level-ups render optimistically and apply
between activities. A snapshot that cannot change mid-activity is what makes replay exact.

## Checkpoint streams

Each activity is one append-only stream: one checkpoint row per version, keyed
`(activity_id, version)`, plus a head row. The head row carries the stream's two cursors —
`appended_head` (how far the client has written) and `verified_head` (how far the server has
replayed) — the last chain hash, and the activity status.

- Each checkpoint hashes `{seed/nextSeed, time, type, entropySource}` and links the previous
  checkpoint's hash. The hashed subset is frozen from the first row ever written: it never gains,
  loses, or repurposes a field. The entropy-source tag inside it makes a checkpoint's provenance
  derivable from the chain itself.
- The hash is a chain link, not an outcome proof. Rewards ride outside the hashed subset as signed
  deltas in an open keyed map, and only replay validates them.
- Appends compare-and-swap the head row's `appended_head`. A stale head returns a retryable conflict
  carrying the current head, and the client resends the tail. Resubmission is a free dedupe —
  `UNIQUE(activity_id, version)` plus deterministic checkpoint content — and dedupe runs before
  elapsed-time accounting, so replays never inflate duration.
- A session-epoch fence rejects appends from evicted sessions as fatal. Terminal statuses (stopped,
  rejected, capped, quarantined) reject any later append. Together these resolve every race between
  logout, forced logout, stop, rejection, and cap.

## Verification

A queue-fed worker replays submitted checkpoint batches and compares results. Verification is
per-stream FIFO — version N+1 never verifies before N, because the seed chain would break — and the
worker replays from the `Started` snapshot under the engine version stamped into it, dispatched
through a provider registry so old segments replay under the code and content that produced them.

Ambiguity parks, it never rejects: a version mismatch, an unknown engine, or a timeout is held as an
operational state, not judged as a cheat signal. Only reproducible divergence under a matched
version and snapshot, on repetition, is treated as cheating, and enforcement lands at a session
boundary — never mid-session. A stream that fails verification repeatedly is quarantined and alerted
on rather than retried forever.

The primary health gauge is verification lag: the oldest unverified append across all streams.
Rejection rates are tracked split by cause — an integrity-mismatch spike is almost always a bad
deploy, not a cheating wave.

## Applying verified progress

Verified deltas apply exactly once through a cursor-guarded transaction: advance `verified_head`
with a compare-and-swap — the update applies only if the cursor still holds its expected value —
then apply the delta to identity state and append the outcome event, all in one local transaction. A
crashed worker retries idempotently.

- First-clears, achievements, and other one-shot grants insert into a unique-keyed grant table with
  `ON CONFLICT DO NOTHING` inside the same transaction — idempotent across re-farms and replays.
- Item instances mint at settlement: identity is the restart-stable reward coordinate and content is
  rolled from the avatar's key under the activity's pinned versions (see
  [game entropy](./game-entropy.md)), so re-verification never duplicates or re-rolls an item.
- Rolled content is revealed only for coordinates whose producing checkpoint is durably appended,
  and the reveal is a pure function of the coordinate — append retries and bulk offline resends
  return identical reveals.
- A rejected claim rolls back by forward compensating events, never by snapshot restore: the node's
  seed anchor resets to the verified prefix and revealed-but-unsettled rewards past it are cleared
  from optimistic display.

Resume always anchors on the last verified checkpoint. The client rebuilds optimistic state by
simulating forward from that anchor; it never renders the server's settled progression columns
directly, because they lag verification by design.

## Offline progress

Offline progress is bounded per return. Past the cap the activity stops server-side and resuming
requires a resync. The fast-forward simulates from the last verified anchor; re-simulating a few
already-submitted minutes is harmless — the results are deterministic and resubmission dedupes.

Which rewards offline simulation may produce is an economy rule, not a protocol one: the
[economy modes note](../game-design/004-economy-modes.md) owns it.
