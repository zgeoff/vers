---
name: game-lifecycle
description:
  Load before any work under services/activity, services/replay, libs/game/idle-client,
  libs/game/idle-core, contracts/activity, or contracts/replay. The activity lifecycle inverts the
  usual client-server split, and this skill names the assumptions to drop, the state machines, the
  reading order, and the file that owns each concept.
---

# Game lifecycle

The client authors every activity and simulates it locally. The server admits what the client
submits, proves it later by replay, settles one avatar's activities in the order they were played,
and pays only what it has proved. A file read through the conventional server-authoritative model
looks like a contradiction of the docs, and the docs are right.

## Key rules

- [What's true in this system](#whats-true-in-this-system): the client authors and simulates every
  activity, and the server admits, replays, settles in play order, and pays only what it has proved.
- [Reading order](#reading-order): read the five game architecture docs in full before opening a
  file.
- [State machines](#state-machines): one writer worker owns every client transition, and proof moves
  on a cursor separate from the row's status.

## What's true in this system

- **The client creates every activity.** The worker mints the activity start from the inputs it
  cached at node reveal and starts simulating with no round trip. The server admits that activity
  start in [`advanceActivity`](../../../services/activity/src/handlers/advance-activity.ts) by
  re-deriving every input and refusing a mismatch. A conventional backend creates the record itself.
- **The request path never simulates.** A queue-fed verifier in the replay service re-runs submitted
  checkpoints later, and
  [`runReplayTarget`](../../../services/replay/src/worker/run-replay-target.ts) replays and
  adjudicates each one. A conventional backend validates the move inside the request.
- **The checkpoint hash links, and replay proves.** The hash binds a checkpoint to the previous one
  and attests no outcome, so only a replay under the pinned sim version validates a reward.
- **Proof is a cursor, never a status.** `verified_head` on the head row and the verified anchor on
  the chain row say how far the server has proved. The status column says only whether the run is
  `active`, `stopped`, `capped`, `rejected`, `parked`, or `quarantined`. There is no `verified`
  status.
- **A terminal checkpoint writes `stopped`.** A `completed` or `failed` checkpoint and a player stop
  move the activity row to the same status. The last checkpoint's type says how the run ended.
  [`trackActivityProgress`](../../../services/activity/src/handlers/track-activity-progress.ts) owns
  the checkpoint append, the offline budget, and the terminal transition.
- **One avatar's activities settle in play order.** The client declares the order through
  `predecessorActivityId`. The verifier claims an activity only once its predecessor has settled or
  the verifier has rejected it;
  [`claimNextSeedChain`](../../../services/replay/src/queue/claim-next-seed-chain.ts) owns that
  claim order. A held predecessor blocks its successors, and a rejected one fails them.
- **The server pays only what it has proved.** The client renders optimistic state. The server pays
  for positions at or below the verified anchor, in
  [`applyVerifiedSegment`](../../../services/replay/src/apply/apply-verified-segment.ts). A
  rejection, in [`rejectActivity`](../../../services/replay/src/worker/reject-activity.ts), rewinds
  the appended anchor and reverses no payout already made.
- **A node never re-rolls.** The seed chain is one forward sequence per avatar and node, so a failed
  attempt spends its positions and the next attempt continues past them.
- **Parked and quarantined are holds, not verdicts.** Each stops the avatar's settlement until an
  operator acts. The verifier rejects only reproducible divergence under a matched sim version as
  cheating. A backed-off activity is neither: a dependency failure leaves its status alone and sets
  a retry time through
  [`updateReplayBackoff`](../../../services/replay/src/queue/update-replay-backoff.ts), and the
  verifier skips it until then.
- **The client mints an activity start, and the server admits it.** The server mints continuation
  rows on the offline catch-up path, which
  [`advanceActivity`](../../../services/activity/src/handlers/advance-activity.ts) also owns, and
  chain rows at node reveal, so `mint` in a server handler names one of those and never an activity
  start.

## Reading order

Read all five docs in full before you open a file. The code is split one export per file, so no
single file shows a flow.

1. [`glossary.md`](../../../docs/architecture/game/glossary.md) — the terms the other four docs use
   without redefining.
2. [`game-simulation.md`](../../../docs/architecture/game/game-simulation.md) — the deterministic
   core, the inputs a start pins, and checkpoint streams.
3. [`replay-verification.md`](../../../docs/architecture/game/replay-verification.md) — the
   verifier, what settlement applies, and the sim-version registry.
4. [`seed-chain.md`](../../../docs/architecture/game/seed-chain.md) — positions, the two anchors,
   what moves each, and the order the verifier claims work in.
5. [`offline-reconcile.md`](../../../docs/architecture/game/offline-reconcile.md) — the connectivity
   states, fast-forward, settlement in order, held activities, and the worker lifecycle.

## State machines

One writer worker per browser profile owns every activity transition on the client, and
[`workerLifecycleMachine`](../../../libs/game/idle-client/src/worker/worker-lifecycle-machine.ts)
defines its states. Its flows run one at a time.
[`runResyncFlow`](../../../libs/game/idle-client/src/worker/run-resync-flow.ts) decides what a
reconnect or reopen catches up, and
[`createCheckpointSubmitter`](../../../libs/game/idle-client/src/submission/create-checkpoint-submitter.ts)
owns the durable outbox and its flush.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> starting: player taps a node
  idle --> resyncing: reconnect or reopen
  starting --> running: activity installed
  running --> continuing: terminal checkpoint
  running --> stopping: player stops
  running --> evicting: another session took the writer
  running --> discarding: another device took the account over
  resyncing --> continuing: offline traversal or idle gap to deliver
  resyncing --> idle: nothing to catch up
  continuing --> running: next activity installed
  stopping --> idle: stop request delivered
  evicting --> idle: displaced run cleared
  discarding --> idle: run halted and outbox discarded
```

The server keeps one status per activity row. Proof moves on a separate cursor whatever the status,
so a `stopped` row can be fully verified, partly verified, or not yet claimed.

```mermaid
stateDiagram-v2
  [*] --> active: client-minted start admitted
  state "left active play" as exited {
    stopped
    capped
  }
  active --> stopped: terminal checkpoint or player stop
  active --> capped: offline budget exhausted
  active --> parked: replay impossible for now
  exited --> parked: replay impossible for now
  active --> quarantined: divergence unconfirmed too many times
  exited --> quarantined: divergence unconfirmed too many times
  active --> rejected: replay diverged, or predecessor rejected
  exited --> rejected: replay diverged, or predecessor rejected
```
