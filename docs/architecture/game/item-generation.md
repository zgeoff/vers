# Item generation

One interpreter turns an entropy source into a concrete item, whichever key custody the roll runs
under. The [entropy model](./game-entropy.md) fixes where randomness comes from and who may compute
it. Item generation starts once a source exists and ends at item content: rarity, base, and affixes.

## The roll stream

A roll stream is a deterministic sequence of typed draws: a bounded range, a weighted pick. A
key-expansion function stretches one digest into the stream, so a single digest yields as many draws
as the interpreter asks for, and the same digest yields the same draw sequence. The stream is the
only randomness an interpreter ever sees. Each entropy source has its own stream builder, the code
that turns that source into a roll stream, and an interpreter cannot tell which builder fed it. A
new entropy source is a new stream builder, never an interpreter change.

A keyed position stream starts from a keyed digest over a position's canonical byte encoding, hashed
under the avatar key. Only a key holder can compute it. The keyed position stream builder serves
both reward coordinates and craft positions, and the position type folds into the hashed bytes, so a
craft position and a reward coordinate can never share a digest.

## The interpreter

The interpreter is a library of pure functions over versioned table data. It imports no service code
and does no I/O. The server calls it at settlement, the one call site that rolls.

- The item roll reads a whole item from one stream in canonical draw order: rarity, base, affix
  count, then each affix. Context is the trajectory facts of the slot that produced the roll: the
  node's difficulty, the encounter's class, and the tier of
  [juice](../../game-design/economy-modes.md#juice) the player chose. Context picks which tables the
  stream is read against, and the stream decides the outcomes.
- The affix roll applies a constraint set to an existing base. A crafting roll enters the
  interpreter through the affix roll
  ([craft positions](../../game-design/crafting-entropy.md#craft-positions)).

Context is client-computable, so the rule on heavy upper tails covers it
([perfect foresight](../../game-design/economy-modes.md#perfect-foresight)).

## Draw order is the contract

A content version pins table data and interpreter behaviour together. Inserting, removing, or
reordering one draw shifts every draw after it in the sequence, so any change to the draw sequence
is a new content version. Every shipped content version stays loadable, so mint and replay resolve
under the content version the activity pins ([version pinning](./game-entropy.md#version-pinning)).
The reward reveal read path resolves nothing itself; it returns the item the settlement mint
persisted.
