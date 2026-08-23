# The seed chain

Every activity an avatar runs at a node draws its randomness from one place: that node's seed chain.
The chain is a single sequence of positions running forward. An activity takes the position at the
front, plays out from it, and leaves the next position for the activity that follows. A position is
spent once and never re-taken, so a failed activity costs a position exactly as a completed one
does. Playing a node again never re-rolls the last result — it plays the next stretch of the chain.

The chain carries two anchors, and the distance between them is what the rest of this page turns on.
The **appended anchor** marks how far the player claims to have played. The **verified anchor**
marks how far the server has proved. Play runs ahead of proof, and payment waits for proof.

A chain belongs to one avatar at one **chain scope**: a stable place the avatar can leave and return
to. A world-map encounter's scope is its map node. Two avatars standing on the same node hold two
separate chains, and neither can read or disturb the other's.

This page owns the chain — where one starts, how an activity takes a position, how the two anchors
move, and what a rejection undoes. The simulation that produces an activity, and the replay that
proves it, live in [game simulation](./game-simulation.md). The order the server settles an avatar's
activities in lives in [offline reconcile](./offline-reconcile.md). Why the chain is one flat
forward sequence rather than a tree a player could search lives in
[game entropy](./game-entropy.md#the-seed-chain).

## The journeys the chain must handle

- **A first activity at a node.** The chain is minted when the node is revealed, and the activity
  takes its opening position.
- **A clear, then another activity.** The second activity begins where the first stopped, on
  positions nothing has touched.
- **A failure, then another activity.** The failed activity keeps every position it spent, and the
  retry continues past them.
- **A stop part way through.** The chain advances to the point the player stopped, and no further.
- **A run of activities played with no network.** Each takes its position on the device, and the
  whole run reaches the server at the next reconnect.
- **An activity the server refuses.** The appended anchor rewinds onto the verified anchor, and
  every activity that started past it is rejected.

## Where a chain starts

A node's chain begins at a **genesis seed** the server mints the first time the node is revealed.
The mint is a server CSPRNG (cryptographically secure PRNG) draw: sixteen random bytes as hex,
re-drawn off the one degenerate state the generator cannot use. `revealNodes` writes one chain row
per revealed avatar-and-node pair.

The mint is gated on the avatar's revealed region. A node outside it gets no chain row and no seed
(see [reveal](./worldmap.md#reveal)).

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

Reward coordinates key on `chainIndex`, so reproducing it exactly is what makes a reward
reproducible. It sits inside the frozen set of fields each checkpoint hashes, and the server checks
every submitted checkpoint's index against the value it derives for that position
([game simulation](./game-simulation.md#checkpoint-streams)).

## Taking a position

The client takes a position without asking the server. When the player taps a node, the worker
builds the whole start record from what this device cached at reveal and drops straight into the
simulation. The same synthesis covers a continuation after a terminal checkpoint and an offline gap
caught up on reconnect. The server authors no start; it checks the one the client submits.

`revealNodes` is what stocks the device. For each node it returns the genesis seed, the node's
current appended anchor, the encounter, the content version the encounter was derived against, and
the key and secret stamps the start hash folds in. With the sim version the client already holds,
that is every input a start needs. app-web relays them to the idle worker, which caches each node's
inputs under its avatar-and-node key and the account-wide stamps beside them.

Caching per avatar is what keeps two avatars on one coordinate apart. Each holds its own chain
against its own seed, so neither overwrites the other's cached value.

A start begins at the node's appended anchor rather than at genesis, so it resumes where play on the
node left off. A node never played has an anchor of its genesis seed at index zero. As the client
plays forward it writes each new position back over the cached one, so a later start at that node
begins where this device actually reached — which can sit ahead of the anchor the server holds,
because the server's anchor waits for the activity to end.

### Handing a start to the server

Every synthesized start is written to a durable store before it installs, so a crash between minting
a start and running it still leaves something to deliver.

`advanceActivity` takes such a start when the device next reaches the server. The client sends the
seed, the versions, the start index, the build snapshot, and the start hash it computed offline. The
server re-derives the encounter and the stamps from its own content document and scope secret rather
than trusting the payload. It re-authors the build snapshot from the avatar's own progression and
refuses a start whose submitted snapshot differs. It then requires the client's start hash to equal
the one it just computed itself.

The anchor check is exact. The start's index must equal the chain's appended index, and its seed
must equal the chain's appended seed. A start computed against a position the chain has since moved
past is refused rather than layered onto a position that no longer exists.

What the device does with a refusal depends on whether the refusal can change:

- **A permanent refusal drops the start.** A node that resolves to no coordinate, a chain that was
  never revealed, a sim version past retention, and a start whose simulation genuinely diverged from
  the server's own derivation all mean the server would refuse this start under any order. The
  device drops the start and the checkpoints queued behind it.
- **An order-sensitive refusal keeps it.** A stale anchor, a sim version this deploy has not
  registered yet, an operator hold, and a build snapshot that counted XP from a predecessor still in
  flight all resolve on their own. The device keeps the start and submits it again once the
  predecessor lands or the hold clears.

A start reaches the server by one of two routes. A device that still holds the start's live
simulation ingests it on first contact, and a `NOT_FOUND` answer to that stream's checkpoint flush
triggers one ingest-and-retry of the same batch rather than discarding it. A start orphaned by a
worker reload has no simulation left to drive its flush, so a reconnect drains it instead, ahead of
the checkpoints it would otherwise fail against. The drain delivers in predecessor order, so an
absent predecessor means that predecessor was refused rather than merely late, and the whole subtree
that depended on it is dropped together.

## The two anchors

The chain row is `activity_chains`, keyed by avatar, scope type, and scope id. It holds the genesis
seed, the two anchors, and a replay-queue priority.

| Anchor   | Columns                                      | What it marks                 | What moves it                           |
| -------- | -------------------------------------------- | ----------------------------- | --------------------------------------- |
| appended | `appended_next_seed`, `appended_chain_index` | where a new activity starts   | an activity leaving active play         |
| verified | `verified_next_seed`, `verified_chain_index` | how far the server has proved | the segment that ends a proved activity |

The verified anchor is also the rollback target. Settlement trusts positions at or below it, and a
rejection rewinds the appended anchor onto it.

The `priority` column feeds the replay queue, which reads it as described in
[the order the verifier works in](#the-order-the-verifier-works-in).

The row carries no `updated_at` column and no on-update trigger, so a repeat reveal that re-assigns
its own genesis seed writes no logical change and bumps no timestamp.

## Moving the anchors forward

**The appended anchor moves when an activity leaves active play.** A terminal checkpoint, a player
stop, and an offline cap all leave honest progress behind, and each advances the anchor to the
activity's last appended checkpoint. The advance applies only while the anchor still holds the index
the activity started from, so a duplicate transition finds it already moved and writes nothing.

Two cases advance nothing. An activity that appended no checkpoint at all leaves the anchor alone.
So does one whose only checkpoint is the `Started` one. That checkpoint takes the index one past
where the activity began, exactly as any other checkpoint takes its own, but it draws nothing from
the seed and so leaves the anchor where it stands. Every other tail advances the anchor, including a
tail whose final seed equals the seed it started that segment from — that equality says the last
segment happened to roll nothing, not that the activity consumed nothing.

**The verified anchor moves only when a proved activity ends.** A segment part way through an
activity settles what it proved and advances that activity's own verified cursor, but leaves the
chain's anchor where it stands. The anchor advances on the segment that both ends a forward-exited
activity and reaches its last appended checkpoint. Until then the chain's proved position is the end
of the last activity the server finished with.

That rule leaves a hole the verifier closes itself. A stream can verify completely while its
activity is still active, then leave active play with nothing left to revisit it, so the anchor
advance is missed. When the verifier later claims an activity whose start index sits ahead of the
anchor, it finds the forward-exited predecessor that filled the gap and catches the anchor up before
adjudicating anything.

## Pulling the appended anchor back

Reproducible divergence rejects a stream, and repeated ambiguity quarantines it. In both cases the
appended tail is suspect, and neither ever advances the appended anchor.

A rejection does three things in one transaction:

1. It marks the diverging activity rejected, whether it was still active or had already stopped or
   capped.
2. It rewinds the appended anchor onto the verified anchor, reading the verified columns inside the
   update statement rather than through an earlier select, so no concurrent settlement can land
   between the read and the write.
3. It rejects every activity on the chain that started past the verified anchor, active and
   already-exited alike.

Whatever those activities settled while they were being verified stands. A rejection voids the
chain's unproved remainder; it reverses no payout already made.

A quarantine blocks new activity starts at that scope. Every other chain scope carries on.

Session eviction changes the writer, not the activity. The activity stays active, the new session
rebuilds from the verified anchor and appends from the current head, and the tail is judged on its
own merits. Eviction moves no anchor.

## Paying behind the verified anchor

Settlement and reward reveal both wait on proof. A rolled reward is disclosed only for a position
the verifier has confirmed, never one the client has merely appended, so nothing unproved is paid. A
reward that has synced but not yet verified holds on the client as a pending item until the verifier
settles it.

The unit of proof is the **segment**: the run of checkpoints the verifier adjudicates as one piece.
A stream is judged in pieces as it arrives, and each piece settles what it proved. A run stopped,
capped, or held part way through keeps the XP its proved prefix earned, and an item minted for a
proved segment stays minted.

The XP a checkpoint carries is read two ways. A non-terminal checkpoint's XP is its own delta. A
terminal checkpoint's is the run's final total, containing every delta before it. A segment
therefore settles either the sum of the deltas it proved or, when it ends on a terminal, that total
less what earlier segments already settled. The activity's running total moves in the same guarded
update that advances its verified cursor, so the cursor and the amount can never disagree.

### Building against unsettled XP

A new activity's build snapshot counts the unsettled XP of every run of this avatar's that has ended
and still waits for its verifier. A player who finishes one run and immediately starts another
therefore builds against what they just earned.

A held run is left out. A parked or quarantined run reaches verification only by operator action, so
counting one would stamp XP into this run's snapshot, and every later one's, that never settles.

XP is the only quantity a build snapshot draws ahead of proof, because an item mints only for a
proved segment. Identity is avatar-wide while chains are per-scope, so a snapshot can draw from a
run on another chain.

Drawing ahead is safe because settlement runs in one order per avatar rather than one order per
chain. Each activity names the avatar's immediately-prior activity, and the verifier adjudicates an
activity only once that predecessor has settled or rejected, so every check reads a settled total
and never a drawn one. [Offline reconcile](./offline-reconcile.md#settlement-in-order) owns that
order.

The build re-derivation is what catches a bad draw. On a segment's first proved pass the verifier
rebuilds the expected starting build from the avatar's settled XP total and rejects a pinned build
that does not match, so a run that banked XP a later rejection erased fails. A run chained onto it
fails the same check in turn.

### The progression read

`getAvatarProgression` reads the settled row, one entry per ended-but-unsettled activity, and the
live run's settled-so-far, all in one statement — so a display is never torn between them. The
pending set is the exact inverse of what verification settles: a settlement moves a delta out of the
pending set and into the settled row without changing their sum. A non-empty pending set also pokes
the replay service, so a client watching a "Settling…" display is itself the retry for a poke a
crash or a deploy lost.

The pending set counts parked and quarantined runs, which the build snapshot leaves out. The
difference is deliberate: the pending set is display-only, so showing a held run's earnings costs
nothing, while stamping them into a build would pin XP that never settles.

## The order the verifier works in

The verifier claims one activity at a time, choosing it in two stages.

First it finds one candidate per avatar: that avatar's oldest activity, across every one of its
chains, whose appends run past its verified cursor and whose predecessor has itself settled or
rejected. A parked or quarantined activity is skipped and blocks everything after it, exactly as a
held predecessor does.

Then it picks between those candidates by the `priority` on each one's chain row, taking the highest
and breaking a tie in favour of the older chain. Priority therefore decides which avatar the
verifier works on next. It never reorders one avatar's own chains against each other — the
predecessor order alone does that.

The claim is a row lock on the chosen activity's chain row, held for the transaction. It prevents
duplicated work. It is not what makes application exactly-once — the verified-cursor guard does
that, and a duplicate apply lands nothing.

Two orderings keep the writers from deadlocking. The request-path anchor advance and the verifier
both take the chain row before the activity row. The rejection rewind reads the verified columns
inside its own update statement, never through a prior select, so a concurrent settlement cannot
slip between the two.

## Glossary

| Term            | Meaning                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| seed chain      | One forward sequence of positions per avatar per chain scope; each activity takes positions from it and never re-takes one.                |
| chain scope     | The stable place an avatar leaves and returns to; a world-map encounter's scope is its map node.                                           |
| chain row       | The `activity_chains` row holding one chain's genesis seed, its two anchors, and its replay priority.                                      |
| genesis seed    | The seed a chain starts from, minted by the server when the node is first revealed.                                                        |
| position        | One point on the chain: a seed and a `chainIndex`.                                                                                         |
| chainIndex      | A checkpoint's index along the whole chain, counted from the index its activity started at; reward coordinates key on it.                  |
| appended anchor | The position a new activity starts from, marking how far the player claims to have played.                                                 |
| verified anchor | The position the server has proved, marking what settlement may pay and where a rejection rewinds to.                                      |
| activity start  | An activity's first record — the node, the position, and the stamps — synthesized on the device and checked by the server on ingest.       |
| segment         | The run of checkpoints the verifier adjudicates as one piece; each segment settles what it proved.                                         |
| forward exit    | An activity leaving active play with honest progress behind it: a terminal checkpoint, a player stop, or an offline cap.                   |
| predecessor     | The avatar's immediately-prior activity across every chain, stamped on the device at start; the verifier waits for it before adjudicating. |
