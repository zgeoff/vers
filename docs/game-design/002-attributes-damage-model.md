# Attributes & Damage Model

This note defines the first stable combat stat and damage-system spine for Vers. It should support
PoE-like long-term build complexity without front-loading that complexity into the first playable
loop.

## Attribute Layers

Vers uses two attribute layers: avatar attributes and metagame attributes. They should not compete
for the same item budget or progression choices.

Avatar attributes are local to an avatar. They can appear on gear, avatar passives, class systems,
and other character-power surfaces. They determine how an avatar survives and performs inside
regions.

Metagame attributes are persistent player/world progression. They can appear on metagame passive
trees, idol-like systems, account progression, or other long-term systems. They determine how the
player stabilizes, discovers, and extracts value from the world.

## Avatar Attributes

### Focus

Focus is cadence. It represents rate, recovery, and action tempo.

Focus should improve how often an avatar can act or recover, but it should not replace specific
attack-speed, cooldown, recovery, or trigger itemisation.

### Vigor

Vigor is sustain. It represents regeneration, retention, endurance, and the ability to stay active
under pressure.

Vigor should improve an avatar's broad staying power, but it should not replace specific investment
into life, barrier, block, recovery, or other defensive mechanics.

### Will

Will is effect. It represents the avatar's capacity to impose outcomes on the world.

Will can scale damage, healing, shielding, control, summons, persistent effects, and other applied
combat outcomes. It should provide broad baseline pressure without replacing specific investment
into damage types, skills, ailments, minions, or other archetype-defining systems.

## Metagame Attributes

### Discipline

Discipline is consistency. It represents stable progression, reduced friction, safer outcomes, and
less variance across repeated expeditions.

### Insight

Insight is discovery. It represents information, understanding, hidden opportunities, map knowledge,
and the ability to recognize what the world is offering.

### Aptitude

Aptitude is refinement. It represents practical capability with items, systems, upgrades, and other
long-term tools that turn resources into better outcomes.

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

### Void

Void damage is absence and impossibility: entropy, null effects, erasure, unreality, and forces that
do not fit cleanly into the known material systems.

## Damage Events

The base damage model should be readable while leaving room for deep item, skill, enemy, and region
interactions.

### Hits

Hits are discrete damage events. They are the baseline event type for attacks, skills, and enemy
actions that connect at a point in time.

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
4. Mitigation reduces remaining damage.
5. Barrier absorbs damage before life.
6. Life is reduced by unabsorbed damage.
7. Status effects and secondary outcomes are checked from the resolved event.

This order is a design spine, not a final formula. Individual skills, items, enemies, and regions
may alter it when a specific build or encounter needs a rule-breaking hook.

## Scaling Philosophy

Focus, Vigor, and Will should be universally useful but modest. They provide broad pressure,
sustain, and effect so every avatar benefits from them, but they should not become the only stats
that matter.

Build archetypes should come primarily from skills, gear, passives, damage types, status effects,
summons, region interactions, and defensive-layer investment. Attribute stacking can exist, but it
should not erase those more specific choices.

The damage model should support long-term complexity through item, skill, passive, enemy, and region
interactions. The first implementation should expose a small stable core, then add specialized rules
only when they create meaningful build or encounter identity.

## Non-Goals

This note does not define exact formulas, ailment lists, resistance caps, block math, avoidance
math, or complete itemisation rules. Those belong in downstream combat, itemisation, enemy, and
progression notes.
