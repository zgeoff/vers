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
  on — a resource that accrues and spends, a mode toggle, an escalation counter — or a rule that
  changes how the game resolves for every build that holds it. It is never a build archetype.
  Damage-over-time, minions, and critical-strike identities are expressed by gear, skills, and the
  Azimuth; a class made of one steals expression from those systems, the way a class made of a
  direction would steal it from the Azimuth.
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

## Specialization

A specialization deepens and steers the one rule a class already owns rather than adding a second,
so everything an avatar is traces back to a single mechanic. A base class carries a few — three is
the aim — and each is a distinct expression of its mechanic, often by routing it through some other
universal system so the two interlock.

Any system a specialization draws on is universal — a resource pool, a defensive layer, the beat
cadence — never a build archetype. Drawing on a damage type would smuggle a build back into the
class layer and break the generic-or-transformative law at the specialization level.

A specialization is a small branching structure of three tiers, one exclusive choice per tier. Each
is free, and encouraged, to build its own internal framework rather than fill a fixed template. One
example runs output, then fuel, then fusion: the first tier steers what the mechanic drives, the
second steers how it accrues and scales, and the third fuses the mechanic with a coupled system into
one engine.

Choosing a specialization is a one-time commitment, re-chooseable with investment. The three tier
choices within a chosen specialization respec freely, like passive allocation. A specialization
unlocks through progression.

## Worked Example

The following is illustrative — it shows the model's shape, not a class the game ships.

Take a base class whose mechanic is a resource that accrues as the avatar acts and amplifies its
output. That resource, how it accrues, and what it amplifies are the entire base class, and it plays
on its own.

One of its specializations routes that resource through another universal system across three tiers:

- **Tier 1 — output.** The resource additionally drives one of a small set of chosen effects.
- **Tier 2 — fuel.** The resource's ceiling or accrual scales with the coupled system.
- **Tier 3 — fusion.** The resource and the coupled system feed each other into a single engine.

Its sibling specializations express the same resource differently — routing it through other
systems, or scaling it through itself — each a distinct read on the one mechanic.

## Non-Goals

This note does not define any class's exact mechanic, resource values, accrual rates, or balance;
the full content of any specialization's tier choices; specialization unlock conditions or respec
cost; the launch class; or how any class interacts with specific skills, gear, or enemy families.
Mechanic and balance detail belongs to the combat note; unlock and respec cost to the progression
note; the per-class content to each class's own downstream ticket.
