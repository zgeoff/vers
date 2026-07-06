# Attributes & Damage Model

This note defines the first stable combat stat and damage-system spine for Vers. It should support
PoE-like long-term build complexity without front-loading that complexity into the first playable
loop.

## Damage Types

Vers starts with six damage types. The set is intentionally wider than a traditional fantasy ARPG
element spread, so itemisation should not expect every build to cover every offensive or defensive
type equally.

### Kinetic

Kinetic damage is physical force: impact, rupture, blades, ballistics, crushing pressure, and other
direct material trauma.

### Thermal

Thermal damage is temperature stress: heat, cold, plasma, burning, freezing, and extreme energetic
transfer.

### Voltaic

Voltaic damage is charge and overload: electricity, arcs, signal disruption, shorting, and hostile
energy flow through bodies or systems.

### Toxic

Toxic damage is contamination: chemical exposure, biological attack, corrosion, poison,
environmental taint, and other damaging intrusion.

### Cognitive

Cognitive damage is hostile patterning: perception attack, neural interference, signal confusion,
memory pressure, and other effects that harm through thought, control, or understanding.

### Null

Null damage is absence and impossibility: entropy, erasure, unreality, and forces that do not fit
cleanly into the known material systems.

## Damage Events

The base damage model should be readable while leaving room for deep item, skill, enemy, and region
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
from unlucky sequences — max-hit ceilings against expected defensive pools, not hard caps. Players
who juice an instance deliberately trade that safety for yield; the appetite to go deeper should
never hit a wall. Exact numbers belong to the progression and enemy notes.

### Persistent Damage

Persistent damage applies over time or across a duration. It may come from damage types, regions,
status effects, skills, enemies, or item modifiers.

### Status Effects

Status effects are secondary outcomes caused by damage types, skills, enemies, regions, or item
modifiers. They may impair, amplify, control, reveal, weaken, protect, or otherwise alter combat.

Status effects should not be fully enumerated in the first pass. The damage model only needs enough
structure to support them later.

## Defensive Layers

Defenses should be layered so gear, passives, enemies, and regions have multiple hooks for build
expression.

### Avoidance

Avoidance is the chance or condition that prevents a hostile action from connecting. It is the broad
layer name; future mechanics may express it through evasion, misdirection, prediction, interference,
or other sources.

### Block

Block intercepts a connected hit and reduces, changes, or negates its impact. It should remain
distinct from avoidance: avoidance stops connection, block handles a connected event.

### Mitigation

Mitigation reduces the impact of damage that was not avoided or fully blocked. It includes
type-appropriate defenses and other reductions that make incoming damage smaller.

### Barrier

Barrier is recoverable protection consumed before life. It fits the synthetic-world premise better
than a fantasy shield while still giving builds a clear buffer layer.

### Life

Life is the avatar's health. Reaching zero life causes defeat or activity failure according to the
surrounding activity rules.

## Resolution Spine

The default resolution order is:

1. A hostile action attempts to connect.
2. Avoidance may prevent connection.
3. Block may intercept a connected hit.
4. A connected hit may resolve as critical, scaling its damage.
5. Mitigation reduces remaining damage.
6. Barrier absorbs damage before life.
7. Life is reduced by unabsorbed damage.
8. Status effects and secondary outcomes are checked from the resolved event.

This order is a design spine, not a final formula. Individual skills, items, enemies, and regions
may alter it when a specific build or encounter needs a rule-breaking hook.

The order is also the structure of expedition reporting: each defensive layer consumed is
escalation, and a hit that reaches life is a close call worth reporting. Reporting carries both a
high-level summary and the drill-down that explains it — including what failed on defeat; its own
design note owns the specifics.

## Threat Mix & Coverage

Five of the six damage types are resistable: type-specific mitigation exists for Thermal, Voltaic,
Toxic, Cognitive, and Null, and an endgame avatar is expected to reach the mitigation cap for the
types its target regions deal. Kinetic is not resistable — it is the universal pressure type,
handled through the other defensive layers rather than a resistance stat.

Regions are weighted toward a dominant damage type but never deal it exclusively. Type mitigation is
specced against a region's mix, and the type-agnostic layers — Avoidance, Block, Barrier — are the
floor under whatever a build has not covered.

Every damage type has at least one region or faction that expresses it. The strange types are
progression-gated: Cognitive appears later, and Null is endgame. The type spectrum deepens as
avatars push farther from Respite.

Enemies use the same defensive layers as avatars, including Kinetic mitigation of their own — so
Kinetic is universal pressure in both directions, not a strictly-best attacking type. Layer
distribution across enemy families is a tuning choice (heavily avoidance-stacked enemies are rarely
fun), and no mechanic converts incoming Kinetic into a resistable type.

A region's damage mix is also its history: mechanical drift reads as Kinetic, Voltaic, and Thermal;
ecological drift as Toxic; human drift as Cognitive; total drift as Null. Reading a threat table is
reading the region's biography.

## Resource

Avatars act on cadence: attacks, skills, and recovery run on their own beats, and idle play means
those beats fire without piloting. Reserve (provisional name) is the single avatar resource layered
over that cadence. Skills relate to it in one of three ways:

- **Free** skills fire on their beat at no cost. They are the baseline lane: a starved avatar
  degrades to its free skills instead of stalling.
- **Costed** skills spend Reserve to fire. A costed skill that cannot pay skips its beat rather than
  blocking the avatar — free skills hold the rotation's floor, and the real tax is the output gap
  between that floor and what the costed beat would have added. A costed skill should be stronger
  per beat than a free one by roughly the value of its cost, and the build question is whether
  regeneration can sustain it.
- **Optional-cost** skills fire either way and consume Reserve for a stronger outcome when it is
  available. Empowerment converts Reserve less efficiently than a costed skill's cost does —
  flexibility is taxed, so costed skills remain the efficient way to spend. Empowerment uptime is a
  build outcome worth reporting to the player.

Cost shape is a skill property, not a class rule. Archetypes may still skew the flow — heavy
spenders, or generators that build Reserve by acting or being hit — through skills and passives.
Generation is a skill behaviour orthogonal to cost shape, not a fourth shape.

Reserve regeneration falls under Vigor's global-regeneration mandate, and Reserve regeneration and
capacity are first-class build stats. Specific regeneration, cost, capacity, and on-full/on-empty
investment stays in itemisation and skills, as with every attribute.

## Attribute Layers

Vers uses two attribute layers: avatar attributes and metagame attributes. They should not compete
for the same item budget or progression choices.

Avatar attributes are local to an avatar. They can appear on gear, avatar passives, class systems,
and other character-power systems. They determine how an avatar survives and performs inside
regions.

Metagame attributes are persistent player/world progression. They can appear on metagame passive
trees, idol-like systems, account progression, or other long-term systems. They determine how the
player stabilizes, discovers, and extracts value from the world.

## Avatar Attributes

### Focus

Focus is cadence. It governs action rate: how quickly an avatar's skill beats recur. It is not an
attack- or cast-speed modifier — speed of execution stays specific itemisation.

Focus should improve how often an avatar can act, but it should not replace specific attack-speed,
cooldown, or trigger itemisation.

### Vigor

Vigor is sustain. It governs the global regeneration rate: Life, Barrier, and Reserve all recover
faster under Vigor. Because one stat touches all three pools its power is deliberately curbed — and
long-form idle combat keeps even curbed regeneration useful.

Vigor should improve an avatar's broad staying power, but it should not replace specific investment
into Life, Barrier, Block, recovery, or other defensive mechanics.

### Will

Will is effect. It represents the avatar's capacity to impose outcomes on the world.

Will can scale damage, healing, shielding, control, summons, persistent effects, and other applied
combat outcomes. It should provide broad baseline pressure without replacing specific investment
into damage types, skills, ailments, minions, or other archetype-defining systems.

## Metagame Attributes

### Discipline

Discipline is consistency. It represents stable progression, reduced friction, safer outcomes, and
less variance across repeated expeditions.

Discipline's variance reduction is non-combat only — yield spread, extraction reliability,
progression friction — never incoming damage or defeat chance. Survival stays with the avatar's own
defenses.

### Insight

Insight is discovery. It represents information, understanding, hidden opportunities, map knowledge,
and the ability to recognize what the world is offering.

### Aptitude

Aptitude is refinement. It represents practical capability with items, systems, upgrades, and other
long-term tools that turn resources into better outcomes.

Each metagame attribute sits between two of Respite's institutions: Discipline between the authority
and the industry, Insight between the authority and the market, and Aptitude between the industry
and the market. Later alignment mechanics may draw on that geometry.

## Scaling Philosophy

Focus, Vigor, and Will should be universally useful but modest. They provide broad pressure,
sustain, and effect so every avatar benefits from them, but they should not become the only stats
that matter.

Build archetypes should come primarily from skills, gear, passives, damage types, status effects,
summons, region interactions, and defensive-layer investment. Attribute stacking can exist, but it
should not erase those more specific choices.

Archetype is a per-system term, not a single system: skills, defenses, classes, and specializations
each carry their own archetypes, and build archetypes emerge from combining them. Classes are
intended, including a later chosen divergence into a specialized class tier — its name and design
belong to the base-classes note.

The damage model should support long-term complexity through item, skill, passive, enemy, and region
interactions. The first implementation should expose a small stable core, then add specialized rules
only when they create meaningful build or encounter identity.

## Non-Goals

This note does not define exact formulas, ailment lists, resistance caps, block math, avoidance
math, critical chance or magnitude baselines, Reserve cost or regeneration baselines, or complete
itemisation rules. Those belong in downstream combat, itemisation, enemy, and progression notes.
