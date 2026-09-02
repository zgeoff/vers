# Crafting Entropy

Crafting draws its entropy so that an affix roll's tail cannot be scanned, and each craft action
carries an identity so that a retry never spends twice and an item's lineage always replays. The
[entropy architecture doc](../architecture/game/game-entropy.md) owns the built key and coordinate
machinery that base drops resolve under; the
[economy modes note](./economy-modes.md#perfect-foresight) owns the tail rule that decides which
outcomes need sealing.

## Sealed Pre-Commit Salt

Some outcomes are a random draw with a heavy upper tail: a rare, large result a scanner selects for.
Item affix rolls are the concrete case. Their entropy stays sealed while the player's decision is
still open, and it reveals in two committing steps: commit, then release.

### Commit and Release

**Commit.** The player locks in the spend. The server mints the salt from a server-held secret key
and stores it sealed. The player sees only a lossy projection derived from it (modifier families,
difficulty, reward budget) for the preview window. The projection is a distribution summary and
never narrows the realized roll: walking away must never beat resolving, at any tier, and that rule
bounds how much the projection may reveal. Every decision happens against this metadata, and the
client never holds computable entropy while a decision is open.

**Release.** The server resolves the outcome under the salt and returns the result; under server
custody the salt itself never reaches the client. Release is commitment: at a server-side deadline
inside the replay-retention window, the server force-resolves any released position the client never
resolves as forfeited, losing its sealed reward bundle.

### Keeping the Seal Honest

Three rules keep the seal honest, independent of what consumes it:

- The salt's keying material is a server-held secret. Domain-separation labels alone are
  insufficient: salt derived from client-visible state under a different label is still
  client-computable, and the sealing property collapses.
- The server mints salt once per position, and re-fetch is idempotent. A client that loses the
  response retries and receives the same salt, so a lost packet cannot fork the timeline; until the
  release arrives, nothing resolves.
- Every input the outcome depends on is fixed when the salt is minted, so deferring resolution
  cannot improve it.

### What the Seal Admits

The mechanism admits any tail-bearing outcome; each consumer defines its own position, resolution,
and pinned inputs. Item crafting is the worked case: the position is the craft action in the
avatar's crafting sequence, the resolution is applying the result to the item, and the pinned inputs
are the target item and the consumed currency at commit. Application is exactly-once per craft
position, so a network retry never applies a spend twice. A craft's affixes draw this sealed salt; a
base drop's content resolves under the avatar key instead, and the two mechanisms never compose
within one outcome.

Sealed salt requires a live round trip, so tail-bearing content is online content wherever it
appears.

### What Must Be Sealed

Sealing is required only for an outcome whose value is rolled and carries that heavy tail. A value
the player sets by choosing a tier at a published number is not rolled, so it has no tail to select
and can ride client-computable entropy anywhere, interactive selection included. A rolled amount
always carries a tail: bounded is not flat, and best-of-N selects the maximum of a bounded spread as
readily as an unbounded one. So any modifier that rolls a market-grade quantity (yield, roll or pack
count, density) is a rolled reward under the tail rule, and must be sealed or forbidden.

For self-found avatars no entropy is sealable at all, because the player holds the key. That is
consistent with their earnings never reaching the market.

## Craft Positions

Every craft action occupies a position in its avatar's craft sequence, an append-only per-avatar
counter. The position is the action's identity: application is exactly-once per position, so a
network retry never applies a spend twice. A roll-bearing action's entropy keys on its position; a
roll-free action, a deterministic state transition at a published cost, occupies a position all the
same. The sequence is a transaction log first and an entropy source second.

Who assigns a position follows key custody. A self-found sequence is client-authored: the device
numbers its own actions, and the server verifies the sequence by replay. No allocation race exists.
A trade action carries a client-minted action identifier. The server keeps a durable mapping from
that identifier to a position and result, making reservation and application one atomic step. A
retransmitted action lands on its recorded position and returns its recorded result, never a fresh
position or a second spend.

Each position pins the item state it acts on. An action whose identifier or position is already
recorded returns its stored result. A new action whose pinned item state no longer matches is
rejected rather than re-rolled. An item's identity is its lineage: the reward coordinate that
dropped it plus the craft positions applied since. That chain is a complete, replayable provenance
record. A self-found craft sequence verifies by replay under the re-derived device key like any
self-found stream; a trade craft action is server-computed, so there is nothing to replay.

### Streams by Custody

Each custody feeds the shared interpreter through its own stream builder. A trade craft resolution
expands the sealed salt into its stream. A self-found craft, and self-found replay verification,
expand a keyed position digest under the device-held key, the same builder a reward coordinate
rides. `rollAffixesFromStream` is the entry point in every case, and the
[item generation doc](../architecture/game/item-generation.md) owns the interpreter.

### Craft Constraints

A constraint set narrows an affix roll through a closed vocabulary: protect a group, force an affix,
reweight a pool, reroll values only, exclude occupied groups. Constraint application and pool
ordering are canonical, so a pool sorts deterministically before any weighted draw, because both
consume draws from the stream. The vocabulary is machinery; which craft actions exist, what they
cost, and what the affix tables contain is itemisation design.

## Non-Goals

A downstream note owns: the craft actions the game offers and their costs, the affix tables and
their pools, the preview projection's exact fields per tier, and the forfeit deadline's value.
