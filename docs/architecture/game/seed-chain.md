# The seed chain

Every activity an avatar runs at a node draws its randomness from one place: that node's seed chain.
The chain is a single sequence of chain positions running forward. An activity draws the position at
the front, plays out from it, and leaves the next position for the activity that follows. A position
is spent once and never drawn twice, so a failed activity costs a position exactly as a completed
one does. Playing a node again never re-rolls the last result; it plays the next stretch of the
chain.

The chain carries two anchors. The appended anchor marks how far the player claims to have played.
The verified anchor marks how far the server has proved. Play runs ahead of proof, and payment waits
for proof.

A chain belongs to one avatar at one chain scope, a stable place the avatar leaves and returns to. A
world-map encounter's scope is its map node. Two avatars on the same node hold two separate chains.

[Game simulation](./game-simulation.md) owns the activity start the chain feeds and the checkpoint
stream that records each draw. [Replay verification](./replay-verification.md) owns the verifier
that proves a stream and settles it. [Offline reconcile](./offline-reconcile.md#settlement-in-order)
owns the order the server settles an avatar's activities in.
[Game entropy](./game-entropy.md#the-seed-chain) says why the chain is one flat sequence rather than
a tree a player could search.

```mermaid
flowchart LR
  G["genesis seed<br>index 0"] --> P1["activity 1<br>indices 1..n"] --> P2["activity 2<br>indices n+1..m"] --> P3["activity 3<br>appended, unproved"] --> N["next position"]
  VA["verified anchor"] -.-> P2
  AA["appended anchor"] -.-> P3
  R["a rejection rewinds<br>appended onto verified"] -.-> VA
```

## Journeys

- The player attempts a node for the first time. The server mints the chain when it reveals the
  node, and the activity draws its opening position.
- The player stops part way through. The chain advances to the point they stopped, and no further.
- The player runs a string of activities with no network. Each draws its position on the device, and
  all of them reach the server at the next reconnect.
- The server refuses an activity. The appended anchor rewinds onto the verified anchor, and every
  activity that started past it is rejected.

## Where a chain starts

A node's chain begins at a genesis seed the server mints the first time it reveals the node to the
avatar. The server draws the seed from a cryptographically secure generator, stores it, and never
derives it again: the verifier reads the stored value, and a restored device fetches it. The server
mints a seed only for a node inside the avatar's revealed region
([what a player may see](./worldmap.md#what-a-player-may-see)); a node outside it gets no chain.
Revealing the same node twice mints nothing new.

## Positions on the chain

A chain position is a seed and a chain index. The seed is a xoroshiro128+ generator state. An
activity's opening seed is the seed the previous activity left at its last position, copied rather
than computed. The verifier never trusts a submitted seed: it reproduces the position from the chain
and compares.

The chain index counts checkpoints along the whole chain rather than within one activity. It never
resets, so a failed activity's indices are spent and gone. Each activity records the index it
started from. A checkpoint's chain index is that start index plus the checkpoint's position in the
activity's stream, so an activity's first checkpoint sits one past where the activity began. Reward
coordinates key on the chain index, so a replay that reproduces the index reproduces the reward, and
the server checks every submitted checkpoint's index against the value it derives for that position.

## Drawing a position

The client draws its position without asking the server. Node reveal stocks the device with every
input an activity start needs except the sim version, which the client already holds, and among
those inputs are the node's genesis seed and its current appended anchor. An activity begins at the
node's appended anchor rather than at genesis, so it resumes where play on the node left off; a node
never played has an anchor of its genesis seed at index zero. A device that plays forward begins its
next activity at the position it reached. That position can sit ahead of the anchor the server
holds, because the server's anchor waits for the activity to end.

### Handing an activity start to the server

The worker hands each activity start to the server on the next contact
([authoring an activity start](./game-simulation.md#authoring-an-activity-start)), and the server
checks the anchor exactly. A start's index must equal the chain's appended index, and its seed must
equal the chain's appended seed. A start computed against a position the chain has since moved past
is refused rather than layered onto a position that no longer exists.

A refusal that can clear keeps the start on the device, and a refusal that holds under any order
drops it. A stale anchor, a sim version this deploy has not registered yet, an operator hold, and a
build snapshot that counted XP from a predecessor still in flight all clear on their own, so the
worker resends the start on its backoff
([worker lifecycle](./offline-reconcile.md#worker-lifecycle)). A chain that was never revealed, a
sim version past retention, and a simulation that diverged from the server's own derivation never
clear, so the worker drops the start and the checkpoints queued behind it. The device tells the two
apart by the refusal's error code and by the `reason` a `CHECKPOINT_INVALID` refusal carries
([error handling](../services/error-handling.md)).

## The anchors

The appended anchor moves when an activity forward-exits, leaving active play with honest progress
behind it. The anchor moves to the activity's last appended checkpoint, and only while it still
holds the index the activity started from, so a duplicate transition writes nothing. An activity
that appended nothing, or whose only checkpoint is the `Started` one, moves nothing, because the
`Started` checkpoint draws nothing from the seed.

The verified anchor moves only when a proved activity ends. A segment part way through an activity
settles what it proved and advances that activity's own verified cursor, but leaves the chain's
anchor where it stands. The anchor moves on the segment that both ends a forward-exited activity and
reaches its last appended checkpoint. When the verifier claims an activity whose start index sits
ahead of the anchor, it catches the anchor up from the forward-exited predecessor before it
adjudicates.

Settlement trusts a position only at or below the verified anchor
([applying verified progress](./replay-verification.md#applying-verified-progress)). The chain also
carries a replay priority: the verifier picks between avatars by the priority on their chains,
highest first and older chain on a tie, and it never reorders one avatar's own chains against each
other. Whoever moves an anchor, the request path or the verifier, takes the chain row before the
activity row, so the two writers never deadlock.

## Pulling the appended anchor back

The verifier rejects a stream whose divergence it can reproduce. One transaction does three things:

1. It marks the diverging activity rejected, whether it was still active or had already
   forward-exited.
2. It rewinds the appended anchor onto the verified anchor in one guarded update.
3. It rejects every activity on the chain that started past the verified anchor, active and
   already-exited alike.

Rejecting a stream voids the chain's unproved remainder and reverses no payout already made. A
quarantine moves neither anchor, and a writer handover moves neither anchor.

## Building against unsettled XP

A new activity's build snapshot counts the unsettled XP of every activity this avatar has ended that
still waits for its verifier, so a player who finishes one activity and starts another builds
against what they just earned. Identity is avatar-wide while chains are per scope, so a snapshot
draws from activities on other chains too. A held activity does not count: a parked or quarantined
activity reaches verification only when an operator intervenes, so counting it would stamp XP that
never settles into this snapshot and every later one. XP is the only quantity a snapshot draws ahead
of proof, because an item mints only for a proved segment.

The client predicts the snapshot as the previous activity's start snapshot plus that activity's own
XP, and the server folds the same rule from its own rows. A worker with no record of the previous
activity, on a fresh device or after the server closed it, mints from the snapshot the server
returns beside the avatar's latest activity.
