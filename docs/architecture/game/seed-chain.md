# The seed chain

Every `(avatar, chain scope)` pair owns one forward, append-only seed chain. A chain scope is a
`(scope_type, scope_id)` pair identifying a stable, returnable target — the world map's node is the
`world_map_node` scope. Each activity at the scope draws its seed from the chain's current position
and advances it, so the next activity continues from where the last one left off. A completed,
failed, or abandoned attempt advances it alike, so a re-attempt is a fresh continuation, never a
replay. This page is the chain's data model and lifecycle; the
[entropy model](./game-entropy.md#the-seed-chain) covers why the chain takes this shape and how its
flatness prices look-ahead.

## The chain row

`activity_chains`, keyed `(avatar_id, scope_type, scope_id)`, holds the chain's state as two
cursors:

- The **appended anchor** (`appended_next_seed`, `appended_chain_index`) is the derivation source. A
  new activity seeds from it. It moves the instant an activity's tail is written, ahead of
  verification, so offline play never waits on the verifier.
- The **verified anchor** (`verified_next_seed`, `verified_chain_index`) is the settlement watermark
  and the rollback target. Settlement trusts positions at or below it.

`genesis_seed` records the origin seed. The row carries no `updated_at` column and no on-update
trigger, so a reveal that self-assigns `genesis_seed` to keep the mint idempotent bumps no timestamp
and writes no logical change.

The chain row spans a scope's activities. A
[checkpoint stream](./game-simulation.md#checkpoint-streams) and its head-row cursors span a single
activity.

## Seeds and chainIndex

A seed is a 128-bit xoroshiro128+ state carried as a 32-character hex string. A continuation seed is
the previous activity's final checkpoint `nextSeed`, copied verbatim: the derivation is identity.
The verifier reproduces the seed from the appended chain rather than trusting a submitted value.

`chainIndex` counts checkpoints along the whole chain, monotonic across activities so a failed
attempt's positions are spent, never reused. An activity carries `start_chain_index`, stamped at
start from the chain's appended cursor. A checkpoint's `chainIndex` is
`start_chain_index + version`, where `version` is its 1-based position in the activity's stream. The
`Started` checkpoint sits at `start_chain_index + 1`. Reward coordinates and sealed-salt positions
key on this value.

`chainIndex` sits in the checkpoint's frozen hashed subset, so replay reproduces every coordinate.
The server validates each checkpoint's `chainIndex` against `start_chain_index + version`.

## Genesis

A chain scope's genesis seed is a server CSPRNG mint: sixteen random bytes as hex, re-rolled off the
degenerate all-zero xoroshiro state. The server writes it to the chain row when the row is first
created for the pair. It needs no re-derivation: the verifier reads the stored value, and a restored
device fetches it. A client cannot compute it and cannot steer it, since the scope and the avatar
are both fixed before the mint.

## Advancing the chain

The chain advances on an activity's transition out of `active`. Which cursor moves depends on
whether the appended tail is trustworthy.

### Forward exits

A terminal checkpoint (completed or failed), a user stop, and an offline cap all leave honest
progress. The request path advances `appended_next_seed` and `appended_chain_index` from the last
appended checkpoint. A compare-and-swap on the activity's `start_chain_index` guards the advance, so
a duplicate transition moves nothing. An activity that appended nothing leaves the anchor untouched,
as does one whose only checkpoint is `Started` — its `nextSeed` equals the seed, so nothing was
consumed.

### Adverse exits

Reproducible divergence rejects a stream. Repeated ambiguity quarantines it. The appended tail is
then suspect and never advances the appended anchor.

A rejection rewinds the appended anchor to the verified anchor in one self-referential statement,
setting `appended_next_seed = verified_next_seed` and `appended_chain_index = verified_chain_index`
from the row's own columns. A successor that already rooted past the verified point
(`start_chain_index > verified_chain_index`) is void. Its forward-advance compare-and-swap can no
longer match, and settlement clears its optimistic rewards. A quarantine blocks new activity starts
on the pair. Every other chain scope proceeds.

Session eviction changes the writer, not the activity. The activity stays `active`, and a new
session resumes it from the verified anchor. The tail is adjudicated on its own merits. Eviction
advances nothing.

## Settlement and reveal

Identity settlement and rolled-reward reveal gate on the verified anchor, never on the appended
head, so a suspect tail that later rejects settles nothing to claw back. A synced but unverified
reward holds as a pending item on the client until the verifier settles it.

A consequential read — a new activity's `buildSnapshot`, a future point spend, anything feeding a
new run — anchors on the settled avatar row, never on an appended-but-unverified total. Chains are
scoped per `(avatar, scope)`, and a rejection voids only its own chain's successors. Identity is
avatar-global, so a consequential read of unverified xp would let a rejected run on one chain
contaminate every other chain the same avatar plays.

`getAvatarProgression` reads the settled row and its pending projection in a single statement, so a
client display is never torn between the two. The pending projection holds one entry per
terminal-but-unsettled activity, sourced from that activity's own stored checkpoint. The settlement
apply moves a delta from the pending set into the settled row atomically, so any single read of the
pair sees the same total before and after. The pending projection is display-only.

## Concurrency

- The verifier serializes a chain's activities on the chain row, adjudicating one at a time in
  order, so a continuation never confirms against a predecessor that later rejects.
- The request-path forward-advance and the verifier both acquire the chain row before the activity
  row, a single ordering that admits no cycle.
- The rejection rewind reads the verified columns inline in its update statement, never through a
  prior select, so a concurrent confirm cannot slip between the read and the write.
