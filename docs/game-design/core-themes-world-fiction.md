# Core Themes & World Fiction

Vers is an idle ARPG/MMO set in a far-future human world. The player shapes an avatar, sends it into
regions civilization no longer governs, and turns what it recovers into power. The player contract,
the world premise, the identity pillars, the naming grammar, and the vocabulary register below are
the root every downstream design note inherits. Lore is texture around progression, never a bible.

## Contract

Vers is an idle ARPG/MMO where you shape your avatar, send them into dangerous regions, turn loot
into power, push farther into harder, stranger parts of the world, and compete.

## Decisions

### Genre

Vers is an idle ARPG/MMO first. Its core appeal is loot, builds, region progression, enemy pressure,
long-term avatar investment, and the steady conversion of rewards into power. Power is the broad
result of successful expeditions: equipment, materials, knowledge, access, avatar enhancement, and
anything else that helps the player push farther or more efficiently.

Idle is the fantasy itself: shaping your avatar, sending them into the world, and watching their
build prove itself over time.

### World Premise

Vers takes place in a far-future human world where civilization persists around Respite — officially
Habitat Nine — the largest known human center. Beyond it are older, stranger, partially autonomous
regions that most people cannot safely enter.

The world was never destroyed; it stopped answering. Civilization built on itself for so long that
most of the world now runs on its own accumulated logic — infrastructure that no longer recognizes
anyone's authority, ecologies that were designed once and have since gone their own way, and human
societies that broke from Respite and became something stranger. Respite is the largest place that
still answers to the people living inside it. A region's danger is a measure of how far it has
drifted — mechanical, ecological, or human; its value is what it still produces, protects, or knows.

Those regions are the world map: real places and systems that can be entered, cleared, revisited,
pushed through, and eventually competed over. They include abandoned infrastructure, synthetic
ecologies, failed habitats, hostile machine systems, contested frontiers, and other places where
ordinary life cannot safely operate. They are dangerous because they are no longer fully governed by
human civilization, and valuable because they contain the power, materials, knowledge, and enemies
that drive progression.

The world feels artificial, luminous, polluted, overbuilt, and old. Civilization is advanced, but
not clean. Its systems have accumulated for so long that infrastructure can feel like terrain,
history, hazard, and myth at the same time.

Respite is central, but it is not omniscient. Its maps, institutions, factions, and public histories
can be incomplete, biased, or deliberately constrained. This gives the world room for discovery
without making lore the main activity.

### Avatar Premise

An avatar is an enhanced human shaped by the player and capable of entering regions that ordinary
people cannot survive. "Avatar" is the worn remnant of a longer phrase — avatar _of_ something — and
what filled the blank is lost; rival accounts contest what it was. What is known: the capacity is
inborn, appearing by chance in some and not others, and no institution can manufacture it. The
player-facing fantasy stays direct: shape your avatar, send them into danger, recover power, push
deeper — the contract, embodied in one person.

Avatars are embodied people, not disposable drones. They can be augmented, equipped, specialized,
injured, defeated, recovered, ranked, and eventually set against other avatars.

### Institutions & Factions

Factions run on two axes: the institutions inside Respite, and what remains of the other habitats
outside it.

Three institutions anchor Respite, each defined by what it wants from an avatar's expeditions:

- **The authority over the outside** licenses expeditions and keeps the maps, catalogues, and public
  histories. It wants what an expedition learned. What it publishes is incomplete by design — the
  bias in Respite's picture of the world has an author. The in-game codex is its artifact.
- **The market** turns salvage into value: commerce, currency, and the funding that makes
  expeditions worth mounting. It wants what an expedition carried back.
- **The industry** transforms what the world yields: refinement, equipment, crafting, and the
  augmentation of avatars among its trades. It wants raw material from expeditions — and proof of
  how its work held up in the field. The crafting screens are its artifacts.

Each institution owns the screens that express it: a major screen reads as an artifact of the
institution behind it, so each feels distinct and inhabited. These are thematic anchors: downstream
notes attach mechanics to them as they need a licensor, a market, or a fabricator, and institution
names follow the world's naming grammar. Institutions carry player alignment and perks; a downstream
note owns that design.

The other habitats are the external axis. Records are incomplete: some habitats fell and are ruin,
some still run with no one left inside, some broke away and became societies Respite no longer
recognizes — and some numbers have no entry at all. Habitats can anchor region, faction, and enemy
identities — including the stranger damage types — as downstream notes need them.

### Story Weight

Vers is story-light, not lore-empty. No campaign narrative is the main activity, and named enemies,
bosses, regions, factions, events, items, and systems gradually imply a larger world.

Lore is discovered as texture around progression. It explains why the world works and never
interrupts the idle ARPG loop.

### Competition

Competition is part of Vers, and it does not dominate the first playable identity. The design leaves
room for ladders and PvP from the beginning, while the first loop is PvE region progression.

The word _versus_ is part of the name's meaning. Early game design expresses that pressure through
danger, comparison, mastery, and eventual direct conflict.

The MMO layer is economic and competitive, not spatial: play is instanced, and players meet through
a shared market, ladders, and eventually direct PvP. Loot is tradeable, so drop, crafting, and
currency design assume a player economy from the start. Direct PvP is build against build — two
players' planning resolved in a fight both can study. Competition over regions is comparative (who
pushes farther, faster), not territorial.

### Defeat Stakes

Defeat ends the activity — an expedition, or any future instanced undertaking. Avatars are always
recovered, never permanently lost.

Defeat costs progress, not the avatar: experience toward the next level is lost but levels are never
removed; yield from the run that was not already extracted is lost; and any investment in the
activity instance is lost — the instance resets to baseline. Extraction is the player's mid-run
banking decision: yield stays at risk until it is pulled out. The player sets extraction as policy,
not by hand — automated rules (extract at a yield threshold, or when defenses degrade) let
unattended runs bank deliberately.

A downstream note owns exact loss rates, minimums, and extraction mechanics.

## Pillars

### Dangerous Regions

The world map is dangerous territory, not a passive level select. Regions imply risk, resistance,
discovery, escalation, and reward.

A good region answers 3 questions: what makes this place unsafe, what makes it valuable, and how it
changes as the avatar pushes deeper.

Regions become harder and stranger as they move farther from Respite's influence. Distance does not
need to be purely geographic: age, autonomy, corruption, hostile control, system drift, and lost
history can all make a region more dangerous and more valuable.

### Synthetic World

Vers is science fiction grounded in human civilization, enhanced bodies, artificial environments,
old infrastructure, and advanced systems. It never defaults to fantasy magic, medieval symbolism, or
space-opera scale.

The strange parts of the world feel engineered, emergent, or historical rather than supernatural.

### Mythic Systems

The world's technology can feel ritualized, symbolic, and only partly understood. Interfaces,
materials, enemy forms, region rules, and item language can carry a sense of hidden structure.

This is how Vers gets mystery without becoming fantasy: advanced systems behave consistently enough
to master, but strangely enough to feel deep.

### Competitive Expedition

Progress is measured by how far and efficiently avatars can push into the world. Ladders and PvP
make that competition explicit, but the core pressure starts with the world itself.

## Naming Grammar

1. **Two registers.** System vocabulary (damage types, hit deliveries, defensive layers, the
   Azimuth) is clinical and stable — it lives in tables and logs. World vocabulary (places,
   factions, enemies, items) is worn and human. Never swap them.
2. **The worn-name pattern.** World things carry an official designation and the vernacular name
   that won: Habitat Nine → Respite, the somatic factor → Aether. The pattern is the template, not a
   one-off.
3. **Numbers are history.** Serials and indices read as accumulated record, not decoration.
4. **Institutions are called what citizens call them**, never their charter name.
5. **Register bans.** No fantasy-magic words in either vocabulary. No console words (`root`,
   `admin`, `null`) in world vocabulary — they are fine in system vocabulary.

## Vocabulary Register

The register covers world vocabulary and cross-cutting terms. System vocabulary lives in
[attributes and damage model](./attributes-damage-model.md) and
[defensive archetypes](./defensive-archetypes.md).

| Term       | Status      | Notes                                                                                                                                                                      |
| ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vers       | Keep        | Carries universe and versus: world exploration plus competition.                                                                                                           |
| avatar     | Canonical   | Enhanced human shaped by the player and sent into dangerous regions.                                                                                                       |
| Respite    | Canonical   | The largest human center; officially Habitat Nine — the vernacular name won.                                                                                               |
| world      | Keep        | The broad play space and fiction layer; not just a menu.                                                                                                                   |
| region     | Provisional | Neutral term for world-map areas.                                                                                                                                          |
| expedition | Provisional | The core activity: outfit an avatar, send it out, recover what returns.                                                                                                    |
| loot       | Keep        | Core ARPG promise.                                                                                                                                                         |
| power      | Keep        | Umbrella term for rewards that help the player push farther or more efficiently.                                                                                           |
| Aether     | Canonical   | The single avatar skill resource: the medium avatars are infused with. Officially the somatic factor — found in avatar blood, never synthesized; the old physics word won. |
| commitment | Provisional | UI label for a build's distance from center; prose uses committed and centered as plain descriptions.                                                                      |
| glyph      | Not canon   | Visual candidate for mythic systems; no world rule uses it.                                                                                                                |

## Downstream Notes

Each note below is unwritten. A reference to "a downstream note" anywhere in the design set names
one of these. Their working names appear nowhere else in the design set.

- **Combat** — the formulas: avoidance and interception math, smoothing, the armour curve, recharge
  timings, buffer hit qualification and deferral and decay rates, resistance caps, critical
  baselines, Aether cost and regeneration baselines, Azimuth requirement thresholds and weight
  magnitudes, and each class's mechanic and balance detail.
- **Skills** — cooldown design, cost shapes, skill target and tempo properties, and any
  Aether-costed defensive option.
- **Itemisation** — affix tables and pools, reward tables and rates, drop design, the craft actions
  and their costs, the craft preview's per-tier fields and forfeit deadline, and the
  single-target-versus-area and burst-versus-sustain properties of equipment.
- **Progression** — loss rates on defeat, extraction mechanics, and specialization unlock and respec
  cost.
- **Economy loop** — offline caps per mode, juice costs, sinks, throughput limits, and
  account-legitimacy gates.
- **Competition** — ladder structure, guild mechanics, and prize events.
- **Classes** — the launch class and each class's specialization content, one note per class.
- **World map** — landmarks (rare distance-scaled nodes shown as pillars of light through the fog)
  and the horizontal variety that carries the world past the difficulty plateau.
- **Enemy families** — enemy layer distributions and enemy critical tuning.
- **Reporting** — expedition reports, per-layer legibility, and empowerment uptime.
- **Fiction** — institution and habitat names, and the economy modes' world names.
- **Institutions and alignment** — alignment mechanics and perks.
