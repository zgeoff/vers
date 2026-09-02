# Item generation

Item generation turns an entropy source into a concrete item through one interpreter, shared by
every consumer under every key custody. The [entropy model](./game-entropy.md) fixes where
randomness comes from and who may compute it. Item generation starts once a source exists and ends
at item content: rarity, base, and affixes.

## The roll stream

A roll stream is a deterministic sequence of typed draws: a bounded range, a weighted pick. Standard
key expansion (HKDF) stretches it from a single digest, so one digest yields as many draws as an
interpreter asks for. Equal inputs produce identical draws. The stream is the only randomness an
interpreter ever sees.

A **keyed position stream** starts from `buildRollDigest`, a keyed hash over a position's canonical
byte encoding under the avatar's roll key. Only a key holder can compute it. Reward coordinates and
craft positions both ride this builder. The position type folds into the hashed bytes, so a craft
position and a reward coordinate can never share a digest.

An interpreter cannot tell which builder fed it. A new entropy source (a verifiable-randomness
beacon, a rotated key generation, or the sealed salt the
[crafting entropy note](../../game-design/crafting-entropy.md#sealed-pre-commit-salt) designs) is a
new builder, never an interpreter change.

## The interpreter

`@vers/item-gen` holds the interpreter as pure functions over versioned table data. It is a `lib`,
consumed by the server for mint at settlement, so it imports no service code and performs no I/O.

- `rollItemFromStream(tables, context, stream)` rolls a complete item in canonical draw order:
  rarity, base, affix count, then each affix. `context` is the producing slot's trajectory facts:
  deterministic, replay-verified selectors (node tier, encounter class, chosen juice tier) that pick
  which tables the stream is read against. Context selects tables; the stream decides outcomes.
- `rollAffixesFromStream(tables, base, constraints, stream)` rolls affixes onto an existing base
  under a constraint set. It is the crafting entry point the
  [crafting entropy note](../../game-design/crafting-entropy.md#craft-positions) builds on.

Context is client-computable, so it obeys the
[tail rule](../../game-design/economy-modes.md#perfect-foresight): a context field that scales a
market-grade quantity is a published scalar chosen by the player, never a rolled value.

## Draw order is contract

A content version pins table data and interpreter behaviour together. Inserting, removing, or
reordering one draw shifts every draw after it in the sequence, so any change to the draw sequence
is a new content version. Every shipped version stays loadable: mint and replay resolve under the
version pinned in the activity's `Started` checkpoint, and both agree byte-for-byte across deploys
and key rotations. The reveal read path resolves nothing itself. It returns the content version
already stamped on the settlement mint's persisted row.

## Call sites

| Call site                              | Entry point          | Stream         | Key custody |
| -------------------------------------- | -------------------- | -------------- | ----------- |
| Mint at settlement (`rollRewardItems`) | `rollItemFromStream` | keyed position | server      |
| Reveal read path (activity contract)   | none                 | n/a            | n/a         |
