# Base Classes

A base class is a signature mechanic the rest of the avatar's systems cannot express. The passive
tree, gear, and the Azimuth set how much, which direction, and which damage types an avatar deals —
quantity and position. A class sets the rule the avatar plays by. Nothing else in the game grants a
rule, and a class grants nothing else.

## Class-Design Laws

A mechanic qualifies as a class only when it satisfies all three.

- **Idle-legible.** The mechanic resolves sanely with no one piloting. An avatar runs on beats
  whether attended or not, so a class carries a default policy for every decision it introduces — a
  resource has an automatic spend condition, a mode has an automatic switch rule. A mechanic that is
  only coherent with a human at the controls is disqualified.
- **Generic or transformative, never a build.** A class is either a generic engine any avatar bolts
  on — a rage resource, an Aether dump, an escalation counter — or a rule that changes how the game
  resolves for every build that holds it. It is never a build archetype. Damage-over-time, minions,
  and critical-strike identities are expressed by gear, skills, and the Azimuth; a class made of one
  steals expression from those systems, the way a class made of a direction would steal it from the
  Azimuth.
- **No flat drawbacks.** A class is upside or transformation. Tradeoffs emerge from the mechanic's
  own rules — a mode the avatar is committed to, a resource that must be spent to pay off — but a
  class never carries a bolted-on penalty unconnected to its mechanic.

## The Base Class

A base class is the raw mechanic, playable on its own: the resource or rule, how it accrues, and
what it does. It is complete before any specialization — an avatar that never specializes still has
a functioning class.

Class count is unconstrained. A class is decoupled from every positional and quantitative system, so
adding one is a self-contained content addition rather than a change to a shared structure, and the
game can ship one class and grow the roster over time. Each class is expensive per unit: a bespoke
mechanic carries its own balance and its own interactions with skills and gear, so a class is a
headline addition, not a cheap one.

Every avatar begins at the passive tree's neutral center regardless of class. A class places nothing
on the tree, seeds no Azimuth position, and points at no direction. Class identity and positional
identity are separate axes of a build and combine freely: any class is played at any position, in
any direction, with any damage types.

## Ascendancy

An ascendancy is the base mechanic routed through one universal system. Every base class has three,
each coupling the mechanic to a different system — an Aether coupling, a Life coupling, and a
self-referential or otherwise creative one. An ascendancy never introduces a second mechanic; it
deepens and steers the one the class already owns, so everything an avatar is traces back to a
single rule.

The coupling system is always universal — Aether, Life, Barrier, beat cadence — never a build
archetype. A coupling to a damage type would smuggle a build back into the class layer and break the
generic-or-transformative law at the specialization level.

An ascendancy is a small branching structure of three tiers, one exclusive choice per tier. Each
ascendancy is free, and encouraged, to build its own internal framework rather than fill a fixed
template. One shape that composes well runs output, then fuel, then fusion: the first tier steers
what the mechanic drives, the second steers how it accrues and scales, and the third fuses the
mechanic with the coupling system into a single engine.

Choosing an ascendancy is a one-time commitment, re-chooseable with investment. The three tier
choices within a chosen ascendancy respec freely, like passive allocation. An ascendancy unlocks
through progression.

## Worked Example: Rage

The following mechanic and effects are illustrative — they show the model's shape, not final content
or balance.

The **Rage** base class adds a Rage resource: the avatar gains Rage on hit, and Rage amplifies
damage dealt. That is the entire base class, and it plays on its own.

Its **Aether Focus** ascendancy couples Rage to the Aether system across three tiers:

- **Tier 1 — output.** Rage additionally drives one of: cooldown rate, cast rate, or Aether
  regeneration.
- **Tier 2 — fuel.** Maximum Rage scales with Aether, or Rage gained per hit scales with current
  Aether.
- **Tier 3 — fusion.** Aether regeneration also regenerates Rage; or Aether-spending skills also
  consume Rage for increased effect; or attacks consume Rage for increased damage.

Its sibling ascendancies couple the same Rage mechanic to other systems — a Life coupling that ties
Rage to the Life pool, and a neutral coupling that scales Rage through the mechanic itself.

## Non-Goals

This note does not define any class's exact mechanic, resource values, accrual rates, or balance;
the full content of any ascendancy's tier choices; ascendancy unlock conditions or respec cost; the
launch class; or how any class interacts with specific skills, gear, or enemy families. Mechanic and
balance detail belongs to the combat note; unlock and respec cost to the progression note; the
per-class content to each class's own downstream ticket.
