# Attributes & Damage Model

Combat in Vers resolves through 7 damage types, a small set of damage events, and layered defenses.
Two attribute layers sit beside them: the Azimuth positions an avatar, and the metagame attributes
carry persistent player progression. The model supports long-term build complexity of the kind Path
of Exile carries, without front-loading that complexity into the first playable loop.

## Damage Types

Vers has 7 damage types, each named for its mechanism of harm. The set is intentionally wider than a
traditional fantasy ARPG element spread, so itemisation never expects every build to cover every
offensive or defensive type equally.

### Physical

Physical damage is material force: impact, rupture, blades, ballistics, crushing pressure, and other
direct material trauma.

### Heat

Heat damage is destructive temperature gain: burning, plasma, friction, and radiant transfer.

### Cold

Cold damage is destructive temperature loss: freezing, thermal shock, coolant exposure, and the
failure of tissue and systems in deep cold.

### Electric

Electric damage is charge and overload: current, arcs, shorting, and hostile energy flow through
bodies or systems.

### Toxic

Toxic damage is contamination: chemical exposure, biological attack, corrosion, poison,
environmental taint, and other damaging intrusion.

### Cognitive

Cognitive damage is hostile patterning: perception attack, neural interference, signal confusion,
memory pressure, and other effects that harm through thought, control, or understanding.

### Null

Null damage is absence and impossibility: entropy, erasure, unreality, and forces that do not fit
into the known material systems.

## Damage Events

The base damage model stays readable while leaving room for deep item, skill, enemy, and region
interactions.

### Hits

Hits are discrete damage events. They are the baseline event type for attacks, skills, and enemy
actions that connect at a point in time.

### Critical Hits

A hit may resolve as critical, scaling that hit's impact. Criticals are a property of hits, not a
separate event type: persistent damage and status effects do not crit on their own, though a
critical hit may strengthen the secondary outcomes it causes.

Criticals apply to both sides. Avatar criticals are a build lever: chance and magnitude are both
investable through gear, skills, and passives. Enemy criticals are spike pressure: their chance and
magnitude are independent tuning levers, not inherited from player scaling, and crit mitigation is
an investable defensive answer — circumstantial heavy crits are designed threats that reward
preparing for them.

Baseline content is tuned so an unattended avatar's defeat is predictable from its build rather than
from unlucky sequences — max-hit limits against expected defensive pools, not hard caps. Players who
juice an instance deliberately trade that safety for yield, and nothing caps how deep that appetite
can go. A downstream note owns the exact numbers.

### Persistent Damage

Persistent damage applies over time or across a duration. It may come from damage types, regions,
status effects, skills, enemies, or item modifiers.

### Status Effects

Status effects are secondary outcomes caused by damage types, skills, enemies, regions, or item
modifiers. They may impair, amplify, control, reveal, weaken, protect, or otherwise alter combat.

Status effects are not enumerated here; the damage model carries only the structure they need.

## Defensive Layers

Defenses are layered so gear, passives, enemies, and regions have multiple hooks for build
expression.

### Avoidance

Avoidance is the chance that prevents a hostile action from connecting. Its forms are Evasion and
Dodge, defined in [defensive archetypes](./defensive-archetypes.md).

### Interception

Interception reduces a connected hit before mitigation. Its forms are Block and Deflect, defined in
defensive archetypes.

### Mitigation

Mitigation reduces the impact of damage that was not avoided or fully intercepted. It includes
type-appropriate defenses and other reductions that make incoming damage smaller.

### Buffer

Buffer defers damage: a portion of a qualifying hit lands as decaying damage over following beats
instead of instantly. The [defensive archetypes note](./defensive-archetypes.md) defines it.

### Barrier

Barrier is recoverable protection consumed before Life.

### Life

Life is the avatar's health. Reaching zero Life ends the activity under the
[defeat stakes](./core-themes-world-fiction.md#defeat-stakes).

## Resolution Order

The default resolution order is:

1. A hostile action attempts to connect.
2. Avoidance may prevent connection.
3. Interception may reduce a connected hit.
4. A connected hit may resolve as critical, scaling its damage.
5. Mitigation reduces remaining damage.
6. Buffer may defer a portion of the remaining damage across following beats.
7. Barrier absorbs damage before Life.
8. Life is reduced by unabsorbed damage.
9. Status effects and secondary outcomes are checked from the resolved event.

This order is the default shape, not a final formula. Individual skills, items, enemies, and regions
may alter it when a specific build or encounter needs a rule-breaking hook.

The order is also the structure of expedition reporting: each defensive layer consumed is
escalation, and a hit that reaches Life is a close call worth reporting. Reporting carries both a
high-level summary and the drill-down that explains it, including what failed on defeat. A
downstream note owns the specifics.

## Threat Mix & Coverage

Six of the seven damage types are resistable: type-specific mitigation exists for Heat, Cold,
Electric, Toxic, Cognitive, and Null, and an endgame avatar is expected to reach the mitigation cap
for the types its target regions deal. Physical is not resistable — it is the universal pressure
type, handled through the other defensive layers rather than a resistance stat.

Regions are weighted toward a dominant damage type but never deal it exclusively. Type mitigation is
specced against a region's mix; Avoidance, Interception, and Barrier work against every damage type
and catch what a build has not covered.

Every damage type has at least one region or faction that expresses it. The strange types arrive
with progression: Cognitive appears later, and Null is endgame. The type spectrum deepens as avatars
push farther from Respite.

Enemies use the same defensive layers as avatars, including Physical mitigation of their own —
Physical is universal pressure in both directions. Layer distribution across enemy families is a
tuning choice (heavily avoidance-stacked enemies are rarely fun), and incoming damage never converts
between types.

A region's damage mix is also its history: mechanical drift reads as Physical, Heat, Cold, and
Electric; ecological drift as Toxic; human drift as Cognitive; total drift as Null. Reading a threat
table is reading the region's biography.

## Resource

Avatars act on cadence: attacks, skills, and recovery run on their own beats, and idle play means
those beats fire without piloting. Aether — the medium an avatar is infused with — is the single
avatar resource layered over that cadence. Skills relate to it in one of three ways:

- **Free** skills fire on their beat at no cost. They are the baseline lane: a starved avatar
  degrades to its free skills instead of stalling.
- **Costed** skills spend Aether to fire. A costed skill that cannot pay skips its beat rather than
  blocking the avatar — free skills keep the rotation firing, and the real tax is the output gap
  between that baseline and what the costed beat would have added. A costed skill is stronger per
  beat than a free one by about the value of its cost, and the build question is whether
  regeneration can sustain it.
- **Optional-cost** skills fire either way and consume Aether for a stronger outcome when it is
  available. Empowerment converts Aether less efficiently than a costed skill's cost does —
  flexibility is taxed, so costed skills remain the efficient way to spend. Empowerment uptime is a
  build outcome worth reporting to the player.

Cost shape is a skill property, not a class rule. Archetypes may still skew the flow — heavy
spenders, or generators that build Aether by acting or being hit — through skills and passives;
generation is a behaviour a skill carries, orthogonal to its cost shape. Some abilities recur on
cooldowns longer than a beat; a downstream note owns cooldown design.

Aether regeneration and capacity are stats worth building around. Specific regeneration, cost,
capacity, and on-full/on-empty investment stays in itemisation and skills.

## Attribute Layers

Vers uses two attribute layers: the Azimuth, which positions an avatar, and metagame attributes,
which are persistent player progression. They never compete for the same items or progression
choices.

The Azimuth is local to an avatar and determines what equipment and skills the avatar qualifies for.
Metagame attributes can appear on metagame passive trees, idol-like systems, account progression, or
other long-term systems; they determine how the player stabilizes, discovers, and extracts value
from the world.

## The Azimuth

The Azimuth is the avatar attribute system: three axes, each with two poles, on which a build holds
a position rather than accumulating a quantity. A fresh avatar sits at dead center.

### Axes

- **Melee ↔ Ranged** — where the avatar fights: contact technique, or delivery from distance.
- **Light ↔ Heavy** — the avatar's rhythm: fast beats at small magnitudes, or slow beats that land
  massively.
- **Innate ↔ Altered** — how the avatar's power behaves: innate technique is immediate and
  self-contained — decisive beats, cooldown-driven bursts, effects that resolve on the spot; altered
  instruments linger — durations, ailments, and effects that keep working after the beat that placed
  them. The axis names the behaviour, never a damage type or a defense; what any item or skill asks
  for is its own choice.

### Position

Position comes from the passive tree. Nodes carry directional weight — toward a pole, away from one,
split across axes, or none — and an avatar's position on each axis is the sum of the weight along
its allocated path. Augments may reweight regions of the tree.

An avatar's distance from center is emergent — no system assigns it — and it distinguishes committed
builds (far from center in their chosen directions) from deliberate generalists (near it). The
distance is not a named stat; committed and centered are descriptions of position.

### Requirements

The Azimuth sets requirements; it never grants stats. Position qualifies equipment and skills.

- **Pole requirements** demand a minimum position toward a pole ("requires heavy 60"). They mark
  identity equipment, and exist only where the item's nature earns them.
- **Center requirements** demand a position within a threshold of center. They mark adaptive
  equipment that wants an uncommitted chassis — staying centered is a build choice with its own
  exclusive kit.

Staple equipment carries no requirements: a requirement is the admission ticket to identity gear,
never a power tax on basics, and a build that cannot equip ordinary equipment marks a misdesigned
item, not a misbuilt avatar. Identity equipment enables rather than outscales: passing a requirement
changes what a build can do, never just how big its numbers are.

## Metagame Attributes

### Discipline

Discipline is consistency across the metagame: yield spread, extraction reliability, progression
friction — stable outcomes across repeated expeditions. Survival stays with the avatar's own
defenses.

### Insight

Insight is discovery. It represents information, understanding, hidden opportunities, map knowledge,
and the ability to recognize what the world is offering.

### Aptitude

Aptitude is refinement. It represents practical capability with items, systems, upgrades, and other
long-term tools that turn resources into better outcomes.

Each metagame attribute sits between two of Respite's institutions: Discipline between the authority
and the industry, Insight between the authority and the market, and Aptitude between the industry
and the market. Alignment mechanics may draw on that geometry.

## Scaling Philosophy

The Azimuth positions a build without scaling it: action rate, recovery, and damage scaling live in
gear, skills, and passives.

Build archetypes come primarily from skills, gear, passives, damage types, status effects, summons,
region interactions, and defensive-layer investment.

Archetype is a per-system term, not a single system: skills, defenses, classes, and specializations
each carry their own archetypes, and build archetypes emerge from combining them.
[Base classes](./base-classes.md) owns classes, including a chosen divergence into a specialized
class tier.

The damage model supports long-term complexity through item, skill, passive, enemy, and region
interactions. The model exposes a small stable core; specialized rules exist only where they create
meaningful build or encounter identity.

## Non-Goals

A downstream note owns: exact formulas, ailment lists, resistance caps, interception math, avoidance
math, critical chance and magnitude baselines, Aether cost and regeneration baselines, Azimuth
requirement thresholds and weight magnitudes, and complete itemisation rules.
