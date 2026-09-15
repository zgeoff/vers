# Replay verification

A queue-fed verifier replays each submitted segment under the sim version its `Started` checkpoint
pins, compares the result against the stream, and settles what it proved. A sim-version registry
keeps each engine build replayable for a retention window after a newer build ships.
[Game simulation](./game-simulation.md) owns the client side: the deterministic core, the inputs a
start pins, and the checkpoint stream the verifier reads.
[Offline reconcile](./offline-reconcile.md#settlement-in-order) owns the order the verifier takes
one avatar's activities in, and the [seed chain](./seed-chain.md) owns the anchors a settlement or a
rejection moves.

## Replay

The verifier holds each stream at the checkpoint it last verified for the life of the process, and a
later batch replays forward from that checkpoint. A stream it does not hold instead replays from its
`Started` checkpoint, under the sim version stamped there. It dispatches the replay to the provider
app for that sim version, so an old segment replays under the code and content that produced it. A
checkpoint never verifies before the one before it, because each checkpoint's position on the seed
chain depends on the one before. A drain of the queue starts on:

- a wake from the activity service after an append
- a progression read that finds unsettled work
- the replay service's own boot
- a timer, so work no client asks about again still settles

The verifier never judges an operational failure as a cheat signal. Its outcomes short of a settle:

- Backed off. A dependency failure or an unexpected fault leaves the activity's status alone and
  sets a retry time that grows on each consecutive failure. The verifier skips the activity and its
  successors until that time passes, and a verified segment clears the backoff.
- Parked. An unknown or retention-expired sim version, or a replay that trips its duration cap,
  parks the activity for an operator.
- Quarantined. A divergence that fails to reproduce too many times sets the activity aside for an
  operator rather than retrying forever. While a chain scope holds a quarantined activity, no new
  activity can start there.
- Rejected. The verifier treats only reproducible divergence under a matched sim version and
  `Started` checkpoint as cheating. The server applies a rejection at a session boundary, never
  mid-session.

On an activity's first verified pass the verifier also runs a reachability check and a build check.
Both read only settled state, because by then every predecessor has settled or been rejected
([settlement in order](./offline-reconcile.md#settlement-in-order)), so the unsettled total the
client predicted is the settled total the server reads. The reachability check rejects an activity
at a node that borders no node the avatar has cleared. One exception: the origin always counts as
reachable. The build check re-derives the activity's expected starting build from the avatar's
settled XP total and rejects a pinned build that does not match. A build is a pure function of total
XP, so the build check catches an activity that banked XP a later rejection erased, and the
rejection cascades to every activity chained onto the rejected one. The same first pass re-derives
the node's sealed fields and rejects a mismatch
([sealing a node's contents](./worldmap.md#sealing-a-nodes-contents)).

Replay divergence is not the only cheat signal. Every attempt at a node is a link in the
append-only, server-verified chain, so an avatar that keeps only its favourable results leaves a
record ([reroll scanning](../../game-design/economy-modes.md#reroll-scanning)).

## Applying verified progress

Verified progress applies exactly once through a cursor-guarded transaction. The transaction
advances the verified head only if it still holds its expected value, then writes the newly verified
progress to the avatar's identity state in the same transaction. The cursor guard makes the
transaction idempotent, so a retry after a crash mid-apply applies nothing twice.

- Each segment settles what it proved. A non-terminal checkpoint's XP is its own delta, and a
  terminal checkpoint's is the activity's final total, so a segment settles the deltas it proved, or
  that total less what earlier segments settled. The activity's running total moves in the same
  guarded update as its verified head, so the two never disagree.
- One-shot grants insert idempotently. A first clear inserts into a unique-keyed grant table inside
  the same transaction, and a conflict inserts nothing, so a grant holds however many times the
  avatar repeats the node.
- Item instances mint at settlement. An item's identity is its reward coordinate, and its content is
  rolled from the avatar key under the activity's pinned versions
  ([game entropy](./game-entropy.md)). Re-verification never duplicates or re-rolls an item.
- A reward stays hidden until it is verified. The reward reveal, the read that returns a
  coordinate's rolled content, answers only for a chain position the verifier has confirmed, never
  one only appended, and a reward that has synced but not verified holds on the client as pending.
  The read returns the item the settlement mint persisted, so a resend returns the same reward every
  time.
- A rejection compensates forward, never by restoring a prior database state
  ([pulling the appended anchor back](./seed-chain.md#pulling-the-appended-anchor-back)).

When play resumes, the client rebuilds its own optimistic state by simulating forward from the
verified head.

## Sim-version registry

The replay service serves deterministic replay for one engine build per request, and several engine
builds can be live at once, each answered by its own provider app. An engine build's sim version
derives from the compiled replay engine, and the replay service and the web app bake the same value
([deployment](../platform/deployment.md)). After the replay service deploys, the deploy CLI
reconciles the sim-version registry against the fleet: a sim version with no provider app gets one,
and its row records the newest content version this engine build derives and replays.

The activity service refuses a start whose sim version supports an older content version than the
content registry's current one, answering `SIM_VERSION_EXPIRED` rather than admitting a start it
could never replay. An engine build must therefore deploy and reconcile its row before a content
publish that depends on it goes out. The deploy preflight fails when the current content version is
newer than the newest active engine row supports, and the content publish refuses to move the
current pointer past what that row supports.

### Retention sweep

A registry row's retention deadline is when its version stops being a valid replay target, not when
it disappears. The deploy manifest sets the retention window, and a scheduled workflow runs the
sweep. Each retained version keeps its own provider app running.

The sweep never deletes a registry row, because admission tells an expired version from an unknown
one by the row. A version whose row is `pruned` is expired: the client must resync onto the current
version. A sim version with no row at all is unknown (`SIM_VERSION_UNKNOWN`): the activity parks
until an operator or a later deploy registers it. The sweep instead tombstones each `active` row
past its retention deadline to `pruned`, and it never tombstones the current version. The sweep
refuses to tombstone a version that still has appended-but-unverified activities pinned to it,
because pruning that version would park honest work.

Only after a row is tombstoned does the sweep destroy its provider app, so an `active` row never
points at a destroyed app. The sweep finishes by unparking every activity whose stamped sim version
the registry carries as `active` again, each returning to the status it parked from.
