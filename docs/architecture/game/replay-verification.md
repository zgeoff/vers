# Replay verification

The server never simulates on the request path. A queue-fed verifier replays each submitted
checkpoint segment under the sim version its `Started` checkpoint pins, compares the result against
the stream, and settles what it proved. A registry of sim versions keeps each engine build
replayable for a retention window after a newer build ships. [Game simulation](./game-simulation.md)
owns the client side: the deterministic core, the inputs a start pins, and the checkpoint stream the
verifier reads.

## Replay

A queue-fed verifier replays submitted checkpoint batches and compares its results against the
stream. Replay is per-stream FIFO: `version` N+1 never verifies before N, because the seed chain
would break. The verifier replays from the `Started` checkpoint under the sim version stamped into
it, dispatched through a provider registry keyed by sim version so an old segment replays under the
code and content that produced it. For the sim version this deploy runs, a drain holds each stream
it verified in memory at its verified head for the rest of that drain, so a later batch in the same
drain advances by its delta rather than replaying from `Started`. The next drain, a verifier
restart, or a cache eviction rebuilds from `Started`.

Three triggers start a drain of the queue: the wake the activity service sends after an append, the
replay service's own boot, and a Fly scheduled machine that drains hourly. The scheduled drain is
what retries work no client request will ask about again.

The verifier never judges an operational failure as a cheat signal. A keys or provider call that
fails, an iteration that overruns its 90s deadline, or an unexpected fault backs the activity off:
the verifier leaves the activity's status alone, records a retry time that doubles on each
consecutive failure from 30s up to 15min, and skips the activity and its successors until that time
passes. The next drain after the retry time takes the activity again, and a verified segment clears
the backoff. An unknown or retention-expired sim version, and a replay that trips its duration cap,
park the activity for an operator instead. Only reproducible divergence under a matched sim version
and `Started` checkpoint, on repetition, is treated as cheating. Enforcement lands at a session
boundary, never mid-session. The verifier quarantines a stream whose divergence fails to reproduce
too many times and alerts operators rather than retrying it forever.

Replay also checks reachability and the pinned build. The queue claims an avatar's next activity
only once its predecessor has itself settled or rejected
([offline reconcile](./offline-reconcile.md#settlement-in-order)), so both checks read fully-settled
state.

On a run's first verified pass at a world-map node, the verifier confirms the node borders a node
the avatar has already cleared; the origin always counts as reachable. A node with no cleared
neighbour is rejected. The clear that opened an honest node settles before that node's run is
checked, so its grant is present; an unearned jump reaches a node no clear opened and finds no
grant.

The same first pass re-derives the run's expected starting build from the avatar's settled XP total
and rejects a pinned build that does not match. A build is a pure function of total XP, so this
catches a run that banked XP a later rejection erased. The rejection cascades: a successor chained
onto the mismatched run fails the identical check.

Replay divergence is not the only cheat signal. Every attempt at a node is a link in the
append-only, server-verified chain, so an avatar that keeps only its favourable results leaves a
record. [Reroll scanning](../../game-design/economy-modes.md#reroll-scanning) sets out the detection
that record enables.

Operators watch the verifier through its metrics: replay lag and rejection rates split by cause
([observability](../platform/observability.md)). An integrity-mismatch spike there is investigated
as a deploy regression first, not a cheating wave.

An old sim version stays a valid replay target until its retention window ends
([deployment](#retention-sweep)), and the sweep never tombstones a version that still pins
unverified work.

## Applying verified progress

Verified progress applies exactly once through a cursor-guarded transaction. The transaction
advances `verified_head` only if it still holds its expected value, then writes the newly verified
progress to the avatar's identity state in the same local transaction. A crash mid-apply retries the
transaction idempotently.

- **One-shot grants insert idempotently.** First clears and other one-time grants insert into a
  unique-keyed grant table with `ON CONFLICT DO NOTHING` inside the same transaction, so they hold
  across re-farms and replays.
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

## Sim-version registry

`vers-service-replay` serves deterministic replay for one sim engine build per request. Multiple
engine builds can be live in production at once, each answered by its own per-version provider app.
The deploy CLI computes the engine hash host-side: a sha256 digest over the pure replay entrypoint's
bundled output plus the pinned Bun version (`bun run deploy -- engine-hash`). The CLI passes the
hash as the `SIM_ENGINE_HASH` and `VITE_SIM_ENGINE_HASH` build args to `vers-service-replay` and
`vers-app-web` respectively, so both bake the same value into their compiled output.

After `vers-service-replay` deploys, and on its skipped-deploy path alike, the CLI reconciles the
`sim_versions` table against the fleet's just-deployed image. A hash with no existing provider app
gets one: `vers-replay-<hash12>` (the engine hash's first 12 hex characters), a private flycast IPv6
address, and a machine launched from `vers-service-replay`'s current deployment tag. Provisioning
always launches by tag, because `flyctl machine run` mangles a `@sha256:` digest reference. It
records the digest `machines list --json` resolves the tag to separately. The registry row stores
that digest-pinned image ref, the provider app's flycast URL, and the build's bundled max content
version (`BUNDLED_CONTENT_VERSION`, `libs/game/content-version`), the newest content version this
engine build derives and replays. The row refreshes whenever the fleet's resolved digest or the
bundled content version differs from what's stored, even when the provider app itself needs no
change.

The activity-start admission refuses to stamp a version whose row's max content version falls behind
the content registry's current version, answering `SIM_VERSION_EXPIRED` rather than accepting a
start it could never replay. An engine build must deploy and reconcile its row's max content version
before the content-registry publish that depends on it goes out. Two checks enforce that ordering:
the deploy preflight fails when the registry's current content version is newer than the newest
active engine row's max content version, and the content publish refuses to move the current pointer
past what that row supports.

Pruning stale provider apps and expired registry rows is the retention sweep's job. The deploy CLI
only ever creates and refreshes.

### Retention sweep

A registry row's `retained_until` is when its version stops being a valid replay target, not when it
disappears. The version upsert sets it from the `retentionDays` on the replay entry of
`deploy.config.ts`, so the window is one manifest line: 3 days now, 7 days at the MVP, and 14 days
at public release. Each retained version keeps its own provider app running, so the window grows
only at a release gate, when a larger player population can hold unverified work under an old
version for longer. `.github/workflows/replay-retention.yml` runs
`bun scripts/src/bin/deploy.ts sweep-replay` daily, and it never deletes a `sim_versions` row.
Deleting would collapse a distinction dispatch depends on. A version whose row is `pruned` is
`expired`: the client must resync onto the current version. A hash with no row at all is
`unknownVersion`: the activity parks until an operator or a later deploy registers it. The sweep
instead tombstones, flipping every `active` row past `retained_until` to `pruned` in one statement.
The current version — the newest `active` row by `deployed_at` — is excluded regardless of its own
`retained_until`: a live version is never a valid tombstone target no matter how old its deploy.

Only after a row is tombstoned does the sweep destroy its provider app
(`flyctl apps destroy <app> --yes`). That order is deliberate. A pruned row with a still-running app
is harmless, because dispatch already reports it `expired`. An app destroyed before its row flips
would leave an `active` row pointing at nothing. The sweep finishes by unparking every activity
whose stamped hash the registry now carries as `active`, so an activity parked while its version was
unregistered becomes replayable again once a later deploy provisions it, without waiting on the
client to resync. Each one returns to the status it parked from — a run that had already stopped or
capped resumes as itself, never as an appendable `active` row.

The sweep is idempotent: a repeat run tombstones nothing already `pruned`, destroys nothing already
gone, and unparks nothing already `active`.

The sweep refuses to tombstone a version that still has appended-but-unverified activities pinned to
it, whatever its `retained_until`, because pruning it would park honest work. It prints each refused
version with its count of unverified activities and exits non-zero, so the scheduled workflow fails
and posts to the alarms channel; the next daily run retries once the work settles. A device outbox
the server has never seen can still name a pruned version. That activity start is refused as
`SIM_VERSION_EXPIRED` and the device resyncs onto the current version
([the seed chain](./seed-chain.md#handing-an-activity-start-to-the-server)).
