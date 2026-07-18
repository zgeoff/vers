# Item generation

This is the machinery that turns an entropy source into a concrete item — one interpreter shared by
every consumer, under every key custody. The [entropy model](./game-entropy.md) fixes where
randomness comes from and who may compute it; this document picks up once a source exists and
produces item content from it. Read it when adding or changing a site that turns entropy into an
item — a settlement mint, a craft resolution, a client roll, a replay check — or a new entropy
source feeding one.

## The roll stream

A roll stream is a deterministic sequence of typed draws — a bounded range, a weighted pick.
Standard key expansion (HKDF) stretches it from a single digest, so one digest yields as many draws
as an interpreter asks for. Equal inputs produce identical draws. The stream is the only randomness
an interpreter ever sees. Each entropy source has its own stream builder:

- A **keyed position stream** starts from `buildRollDigest` (`@vers/roll-crypto`), a keyed hash over
  a position's canonical byte encoding under the avatar's roll key. Only a key holder can compute
  it. Reward coordinates and self-found craft positions both ride this builder. The position type
  folds into the hashed bytes, so a craft position and a reward coordinate can never share a digest.
- A **salt stream** expands a sealed pre-commit salt, for trade-avatar craft resolutions.

An interpreter cannot tell which builder fed it. A new entropy source (a verifiable-randomness
beacon, a rotated key generation) is a new builder, never an interpreter change.

## The interpreter

`@vers/item-gen` (`libs/game/item-gen`) holds the interpreter as pure functions over versioned table
data. It is a `lib`, consumed by the server for mint at settlement and craft resolution and by the
client for device-custody local rolls. That `lib` boundary means it imports no service code and
performs no I/O.

- `rollItemFromStream(tables, context, stream)` rolls a complete item in canonical draw order:
  rarity, base, affix count, then each affix. `context` is the producing slot's trajectory facts:
  deterministic, replay-verified selectors — node tier, encounter class, chosen juice tier — that
  pick which tables the stream is read against. Context selects tables; the stream decides outcomes.
- `rollAffixesFromStream(tables, base, constraints, stream)` rolls affixes onto an existing base
  under a constraint set — the crafting entry point.

Context is client-computable, so it obeys the
[tail rule](../game-design/economy-modes.md#perfect-foresight): a context field that scales a
market-grade quantity is a published scalar chosen by the player, never a rolled value.

## Draw order is contract

A content version pins table data and interpreter behaviour together. Inserting, removing, or
reordering one draw shifts every draw after it in the sequence, so any change to the draw sequence
is a new content version. Every shipped version stays loadable: mint, replay, and device rolls all
resolve under the version pinned in the activity's `Started` snapshot. All three must agree
byte-for-byte across deploys and key rotations. The reveal read path resolves nothing itself — it
returns the content version already stamped on the settlement mint's persisted row.

## Craft constraints

A constraint set narrows an affix roll through a closed vocabulary: protect a group, force an affix,
reweight a pool, reroll values only, exclude occupied groups. Constraint application and pool
ordering are canonical — a pool sorts deterministically before any weighted draw — because both
consume draws from the stream. The vocabulary is machinery; which craft actions exist, what they
cost, and what the affix tables contain is itemisation design.

## Craft positions and item lineage

Every craft action occupies a position in its avatar's craft sequence — an append-only per-avatar
counter. The position is the action's identity: application is exactly-once per position, so a
network retry never applies a spend twice. A roll-bearing action's entropy keys on its position; a
roll-free action — a deterministic state transition at a published cost — occupies a position all
the same. The sequence is a transaction log first and an entropy source second.

Who assigns a position follows key custody. A self-found sequence is client-authored: the device
numbers its own actions, and the server verifies the sequence by replay. No allocation race exists.
A trade action carries a client-minted action identifier. The server keeps a durable mapping from
that identifier to a position and result, making reservation and application one atomic step. A
retransmitted action lands on its recorded position and returns its recorded result — never a fresh
position or a second spend.

Each position pins the item state it acts on and rejects a retry against stale state rather than
re-rolling. An item's identity is its lineage: the reward coordinate that dropped it plus the craft
positions applied since. That chain is a complete, replayable provenance record. A self-found craft
sequence verifies by replay under the re-derived device key like any self-found stream; a trade
craft action is server-computed, so there is nothing to replay.

## Call sites

| Call site                               | Entry point                                   | Stream         | Key custody                    |
| --------------------------------------- | --------------------------------------------- | -------------- | ------------------------------ |
| Mint at settlement (replay apply)       | `rollItemFromStream`                          | keyed position | server                         |
| Reveal read path (activity contract)    | none                                          | n/a            | n/a                            |
| Self-found local roll (client)          | `rollItemFromStream`                          | keyed position | device                         |
| Self-found replay verification (replay) | `rollItemFromStream`, `rollAffixesFromStream` | keyed position | server (re-derived device key) |
| Trade craft resolution                  | `rollAffixesFromStream`                       | salt           | server (sealed)                |
| Self-found craft (client)               | `rollAffixesFromStream`                       | keyed position | device                         |
