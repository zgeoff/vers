# The seed chain

Every activity an avatar runs at a node draws its randomness from one place: that node's seed chain.
The chain is a single sequence of positions running forward. An activity draws the position at the
front, plays out from it, and leaves the next position for the activity that follows. A position is
spent once and never drawn twice, so a failed activity costs a position exactly as a completed one
does. Playing a node again never re-rolls the last result — it plays the next stretch of the chain.

The chain carries two anchors. The **appended anchor** marks how far the player claims to have
played. The **verified anchor** marks how far the server has proved. Play runs ahead of proof, and
payment waits for proof.

A chain belongs to one avatar at one **chain scope**: a stable place the avatar can leave and return
to. A world-map encounter's scope is its map node. Two avatars standing on the same node hold two
separate chains, and neither can read or disturb the other's.

Three neighbouring docs own the rest. [Game simulation](./game-simulation.md) explains the
simulation that produces an activity and the replay that proves it.
[Offline reconcile](./offline-reconcile.md) sets out the order the server settles an avatar's
activities in. [Game entropy](./game-entropy.md#the-seed-chain) says why the chain is one flat
sequence rather than a tree a player could search.

## The journeys the chain must handle

- **The player attempts a node for the first time.** The server mints the chain when it reveals the
  node, and the activity draws its opening position.
- **The player clears the node, then attempts it again.** The second activity begins where the first
  stopped, on positions nothing has touched.
- **The player loses, then attempts the node again.** The failed activity keeps every position it
  spent, and the next one carries on past them.
- **The player stops part way through.** The chain advances to the point they stopped, and no
  further.
- **The player runs a string of activities with no network.** Each draws its position on the device,
  and all of them reach the server at the next reconnect.
- **The server refuses an activity.** The appended anchor rewinds onto the verified anchor, and
  every activity that started past it is rejected.

## Where a chain starts

A node's chain begins at a **genesis seed** the server mints the first time it reveals the node. It
draws 16 random bytes from a CSPRNG (cryptographically secure PRNG) and carries them as hex,
re-drawing on the one degenerate state the generator cannot use. `revealNodes` writes one chain row
per revealed avatar-and-node pair.

The server mints a seed only for a node inside the avatar's revealed region. A node outside it gets
no chain row and no seed (see [what a player may see](./worldmap.md#what-a-player-may-see)).

Nothing a client sends can steer the seed, because the avatar and the node are both fixed before the
draw and no input is left to vary. The server stores the value and never derives it again — the
verifier reads it, and a restored device fetches it.

Revealing the same node twice mints nothing new. The second reveal re-assigns the row the genesis
seed it already holds, so any number of concurrent callers converge on the value the first one
wrote.

## Positions on the chain

A position is a seed and an index.

The seed is a 128-bit xoroshiro128+ state carried as a 32-character hex string. Moving from one
position to the next copies a value rather than computing one: an activity's seed is the previous
activity's final `nextSeed`, verbatim. The verifier never trusts a submitted seed. It reproduces the
position from the chain row and compares.

The index is `chainIndex`, and it counts checkpoints along the whole chain rather than within one
activity. It never resets, so a failed activity's indices are spent and gone. Each activity records
the index it started from, and a checkpoint's `chainIndex` is that start index plus the checkpoint's
own position in the activity's stream. The first checkpoint an activity writes therefore sits one
past where the activity began.

Reward coordinates key on `chainIndex`. A replay that reproduces the index reproduces the reward
with it. The index sits inside the frozen set of fields each checkpoint hashes, and the server
checks every submitted checkpoint's index against the value it derives for that position
([game simulation](./game-simulation.md#checkpoint-streams)).

## Drawing a position

The client draws its position without asking the server. When the player taps a node, the worker
builds the whole start record from what this device cached at reveal and drops straight into the
simulation. It builds the same record for a continuation after a terminal checkpoint, and for an
offline gap it catches up on reconnect. The server authors no activity start; it checks the one the
client submits.

`revealNodes` stocks the device. For each node it returns the genesis seed, the node's current
appended anchor, the encounter, the content version the encounter was derived against, and the key
and secret stamps the start hash folds in. With the sim version the client already holds, that is
every input an activity start needs. app-web relays them to the idle worker, which caches each
node's inputs under its avatar-and-node key and the account-wide stamps beside them.

The cache key names the avatar, which is what keeps two avatars on one coordinate apart. Each holds
its own chain against its own seed, so neither overwrites the other's cached value.

An activity begins at the node's appended anchor rather than at genesis, so it resumes where play on
the node left off. A node never played has an anchor of its genesis seed at index zero. As the
client plays forward it writes each new position back over the cached one, so a later activity at
that node begins where this device actually reached — which can sit ahead of the anchor the server
holds, because the server's anchor waits for the activity to end.

### Handing an activity start to the server

The worker writes every activity start it builds to a durable store before installing it. A crash
between building one and running it therefore still leaves something to deliver.

When the device next reaches the server, it hands the activity start to `advanceActivity`. It sends
the seed, the versions, the start index, the build snapshot, and the start hash it computed offline.
The server re-derives the encounter and the stamps from its own content document and scope secret
rather than trusting the payload. It re-authors the build snapshot from the avatar's own progression
and refuses a start whose submitted snapshot differs. It then requires the client's start hash to
equal the one it just computed itself.

The server checks the anchor exactly. An activity start's index must equal the chain's appended
index, and its seed must equal the chain's appended seed. One computed against a position the chain
has since moved past is refused rather than layered onto a position that no longer exists.

What the device does next depends on whether the server would refuse the same activity start a
second time. The device tells the two apart by the refusal's error code, and by the `reason` inside
a `CHECKPOINT_INVALID` refusal, whose reasons split across both outcomes
([error handling](../services/error-handling.md#registry)):

- **The server would always refuse it, so the device drops it.** A node that resolves to no
  coordinate, a chain that was never revealed, a sim version past retention, and a simulation that
  genuinely diverged from the server's own derivation all fail under any order. The device drops the
  activity start and the checkpoints queued behind it.
- **The refusal can clear, so the device keeps it.** A stale anchor, a sim version this deploy has
  not registered yet, an operator hold, and a build snapshot that counted XP from a predecessor
  still in flight all resolve on their own. The device keeps the activity start and sends it again
  once the predecessor lands or the hold clears.

An activity start reaches the server by one of two routes. A device that still holds its live
simulation hands it over on first contact, and if that stream's checkpoint flush comes back
`NOT_FOUND`, the device hands the start over and sends the same batch once more rather than
discarding it. A worker reload can instead orphan a start, leaving no simulation to drive its flush;
the next reconnect delivers it, ahead of the checkpoints it would otherwise fail against. The device
delivers in predecessor order, so a predecessor that is missing was refused rather than merely late,
and the whole subtree that depended on it goes together.

## The two anchors

The chain row is `activity_chains`, keyed by avatar, scope type, and scope id. It holds the genesis
seed, the two anchors, and a replay-queue priority.

| Anchor   | Columns                                      | What it marks                 | What moves it                           |
| -------- | -------------------------------------------- | ----------------------------- | --------------------------------------- |
| appended | `appended_next_seed`, `appended_chain_index` | where a new activity begins   | an activity leaving active play         |
| verified | `verified_next_seed`, `verified_chain_index` | how far the server has proved | the segment that ends a proved activity |

The verified anchor is also where a rejection rewinds to, and settlement trusts positions at or
below it.

The replay queue reads the `priority` column when it chooses what to verify next (see
[the order the verifier works in](#the-order-the-verifier-works-in)).

The row carries no `updated_at` column and no on-update trigger, so a repeat reveal that re-assigns
its own genesis seed writes no logical change and bumps no timestamp.

## Moving the anchors forward

**The appended anchor moves when an activity leaves active play.** A terminal checkpoint, a player
stop, and an offline cap all leave honest progress behind, and each moves the anchor to the
activity's last appended checkpoint. The anchor moves only while it still holds the index the
activity started from, so a duplicate transition finds it already moved and writes nothing.

Two cases move nothing. An activity that appended no checkpoint at all leaves the anchor alone. So
does one whose only checkpoint is the `Started` one: that checkpoint sits at the index one past
where the activity began, exactly as any other checkpoint sits at its own, but it draws nothing from
the seed and so leaves the anchor where it stands. Every other last checkpoint moves the anchor,
including one whose seed matches the seed its own segment began at — that match says the last
segment happened to roll nothing, not that the activity consumed nothing.

**The verified anchor moves only when a proved activity ends.** A segment part way through an
activity settles what it proved and advances that activity's own verified cursor, but leaves the
chain's anchor where it stands. The anchor moves on the segment that both ends a forward-exited
activity and reaches its last appended checkpoint. Until then the chain's proved position is the end
of the last activity the server finished with.

That rule leaves a hole the verifier closes itself. A stream can verify completely while its
activity is still active, then leave active play with nothing left to revisit it, so nothing remains
to move the anchor. When the verifier later claims an activity whose start index sits ahead of the
anchor, it finds the forward-exited predecessor that filled the gap and catches the anchor up before
it adjudicates anything.

## Pulling the appended anchor back

The verifier rejects a stream whose divergence it can reproduce, and quarantines one that stays
ambiguous after repeated attempts. In both cases the activity's last checkpoints are suspect, and
neither case ever moves the appended anchor.

When the verifier rejects a stream, one transaction does three things:

1. It marks the diverging activity rejected, whether it was still active or had already stopped or
   capped.
2. It rewinds the appended anchor onto the verified anchor, reading the verified columns inside the
   update statement rather than through an earlier select, so no concurrent settlement can land
   between the read and the write.
3. It rejects every activity on the chain that started past the verified anchor, active and
   already-exited alike.

Whatever those activities settled while the verifier was still checking them stands. Rejecting a
stream voids the chain's unproved remainder; it reverses no payout already made.

While a scope holds a quarantined stream, no new activity can start there. Every other chain scope
carries on.

Evicting a session changes the writer, not the activity. The activity stays active, the new session
rebuilds from the verified anchor and appends from the current head, and the server judges the new
checkpoints on their own merits. Neither anchor moves.

## Paying behind the verified anchor

The server pays nothing it has not proved. It discloses a rolled reward only for a position the
verifier has confirmed, never for one the client has merely appended. A reward that has synced but
not yet verified waits on the client as a pending item until the verifier settles it.

The verifier judges a stream in pieces as they arrive. Each piece is a **segment**, and each segment
settles what it proved. An activity stopped, capped, or held part way through keeps the XP its
proved checkpoints earned, and an item minted for a proved segment stays minted.

The XP a checkpoint carries is read two ways. A non-terminal checkpoint's XP is its own delta. A
terminal checkpoint's is the activity's final total, containing every delta before it. A segment
therefore settles either the sum of the deltas it proved or, when it ends on a terminal checkpoint,
that total less what earlier segments already settled. The activity's running total moves in the
same guarded update that advances its verified cursor, so the cursor and the amount can never
disagree.

### Building against unsettled XP

A new activity's build snapshot counts the unsettled XP of every activity this avatar has ended that
still waits for its verifier. A player who finishes one activity and immediately starts another
therefore builds against what they just earned.

A held activity does not count. A parked or quarantined activity reaches verification only when an
operator intervenes, so counting one would stamp XP into this activity's snapshot, and every later
one's, that never settles.

XP is the only quantity a build snapshot draws ahead of proof, because an item mints only for a
proved segment. Identity is avatar-wide while chains are per-scope, so a snapshot can draw from an
activity on another chain.

Drawing ahead is safe because the server settles in one order per avatar rather than one order per
chain. Each activity names the avatar's immediately-prior activity, and the verifier adjudicates an
activity only once that predecessor has settled or rejected, so every check reads a settled total
and never a drawn one. [Offline reconcile](./offline-reconcile.md#settlement-in-order) owns that
order.

The verifier catches a bad draw by rebuilding the build itself. On a segment's first proved pass it
derives the expected starting build from the avatar's settled XP total and rejects a pinned build
that does not match, so an activity that banked XP a later rejection erased fails. An activity
chained onto it fails the same check in turn.

### The progression read

`getAvatarProgression` reads three things in one statement: the settled row, one entry per
ended-but-unsettled activity, and how much of the live activity's XP the settled row already
carries. Reading them together is what keeps a display from tearing between them. The pending
entries are the exact inverse of what verification settles, so a settlement moves a delta out of the
pending set and into the settled row without changing their sum. A non-empty pending set also pokes
the replay service, which makes a client watching a "Settling…" display the thing that retries a
poke a crash or a deploy lost.

The pending set counts parked and quarantined activities, which the build snapshot leaves out. The
difference is deliberate: nothing reads the pending set but a display, so showing a held activity's
earnings costs nothing, where stamping them into a build would pin XP that never settles.

## The order the verifier works in

The verifier claims one activity at a time, and chooses it in two stages.

First it finds one candidate per avatar: that avatar's oldest activity, across every one of its
chains, whose appends run past its verified cursor and whose predecessor has itself settled or
rejected. It skips a parked or quarantined activity, which then blocks everything after it exactly
as a held predecessor does.

Then it picks between those candidates by the `priority` on each one's chain row, taking the highest
and preferring the older chain on a tie. Priority therefore decides which avatar the verifier works
on next. It never reorders one avatar's own chains against each other — the predecessor order alone
does that.

The verifier claims by locking that activity's chain row for the length of the transaction. The lock
stops two workers duplicating each other. It is not what makes the work land exactly once — the
verified-cursor guard does that, and applying the same segment twice lands nothing.

Two rules keep the writers from deadlocking. Whoever moves an anchor, the request path or the
verifier, takes the chain row before the activity row. And a rejection's rewind reads the verified
anchor inside its own update statement, as
[pulling the appended anchor back](#pulling-the-appended-anchor-back) describes, so a concurrent
settlement cannot slip in between.

## Glossary

| Term            | Meaning                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| seed chain      | One forward sequence of positions per avatar per chain scope; each activity draws positions from it and never draws one twice.                |
| chain scope     | The stable place an avatar leaves and returns to; a world-map encounter's scope is its map node.                                              |
| chain row       | The `activity_chains` row holding one chain's genesis seed, its two anchors, and its replay priority.                                         |
| genesis seed    | The seed a chain starts from, which the server mints the first time it reveals the node.                                                      |
| position        | One point on the chain: a seed and a `chainIndex`.                                                                                            |
| chainIndex      | A checkpoint's absolute position along the whole chain, counted from genesis and never reset by a new activity; reward coordinates key on it. |
| appended anchor | The position a new activity begins at, marking how far the player claims to have played.                                                      |
| verified anchor | The position the server has proved, marking what it may pay for and where a rejection rewinds to.                                             |
| activity start  | See [game simulation](./game-simulation.md#glossary).                                                                                         |
| segment         | The run of checkpoints the verifier adjudicates as one piece; each segment settles what it proved.                                            |
| forward-exited  | Said of an activity that left active play with honest progress behind it: a terminal checkpoint, a player stop, or an offline cap.            |
| predecessor     | See [offline reconcile](./offline-reconcile.md#glossary).                                                                                     |
