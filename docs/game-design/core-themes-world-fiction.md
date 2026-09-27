# Core Themes & World Fiction

Vers is an idle ARPG/MMO set in a fantasy multiverse. The player shapes an avatar, a mortal who
carries the blood of a god, and sends it out of Respite, the hub city, along the paths into the
worlds beyond. What the avatar recovers there becomes power. The player contract, the world premise,
the identity pillars, the naming grammar, and the vocabulary register below are the root every
downstream design note inherits. Lore is texture around progression, never a bible.

## Contract

Vers is an idle ARPG/MMO where you shape your avatar, send them into dangerous regions, turn loot
into power, push farther into harder, stranger parts of the multiverse, and compete.

## Decisions

### Genre

Vers is an idle ARPG/MMO first. Its core appeal is loot, builds, region progression, enemy pressure,
long-term avatar investment, and the steady conversion of rewards into power. Power is the broad
result of successful expeditions: equipment, materials, knowledge, access, avatar enhancement, and
anything else that helps the player push farther or more efficiently.

Idle is the fantasy itself: shaping your avatar, sending them into the world, and watching their
build prove itself over time.

### World Premise

Vers takes place in a multiverse of many worlds, with Respite at its center. Respite is a
multicultural hub city where travellers, traders, and exiles from every world meet. A few paths
leave the city, and each one leads out into the worlds beyond it.

Those worlds are the world map: the regions an avatar enters, clears, revisits, pushes through, and
eventually competes over. Each region has one legible identity, such as a burning world, a frozen
one, or a drowned one, carried by its biome. A region is dangerous because ordinary mortals cannot
survive it, and valuable because it holds the power, materials, knowledge, and enemies that drive
progression.

The farther a path runs from Respite, the harder and stranger the regions along it become. Every
avatar walks its own map, and the fiction leaves that unexplained.

Respite is central, but it is not omniscient. Its maps, institutions, and public histories can be
incomplete, biased, or deliberately constrained. This gives the multiverse room for discovery
without making lore the main activity.

### The Pantheon

The gods of the pantheon are real and present in the multiverse, and each has interests in the
worlds. The gods hold temples, agents, and debts throughout Respite, and a temple stands in every
quarter of the city rather than in a district of its own. Respite still lies outside their direct
influence: no god acts on the city by its own power, and the fiction gives no reason.

Aether is divine blood. An avatar carries the blood of one god and inherits some of that god's
traits, and the inheritance makes the avatar exceptional among mortals. The blood appears in some
mortals and not in others for no stated reason, and no institution can manufacture it.

Carrying a god's blood makes an avatar neither a worshipper nor a servant. The god has a stake in
the avatar, the way an investor has a stake in a venture, and an avatar owes it nothing by default.
Relations between avatars and gods stay morally grey.

### Avatar Premise

An avatar is a mortal who carries a god's blood, shaped by the player and capable of entering
regions that ordinary people cannot survive. The name is short for the avatar of a god: the god
whose blood the avatar carries. The player-facing fantasy stays direct: shape your avatar, send them
into danger, recover power, push deeper — the contract, embodied in one person.

The player chooses an avatar's bloodline when creating the avatar. The bloodline is one of the few
near-permanent parts of an avatar. Changing it is possible but expensive, and it is never a core
part of the story. A bloodline need not carry mechanical weight: a god whose blood grants identity
and nothing else is a valid member of the pantheon.

Avatars are embodied people, not disposable drones. They can be enhanced, equipped, specialized,
injured, defeated, recovered, ranked, and eventually set against other avatars.

### Institutions & Places

Three institutions anchor Respite, each defined by what it wants from an avatar's expeditions:

- **The authority over the outside** licenses expeditions and keeps the maps, catalogues, and public
  histories. It wants what an expedition learned. What it publishes is incomplete by design — the
  bias in Respite's picture of the multiverse has an author. The in-game codex is its artifact.
- **The market** turns salvage into value: commerce, currency, and the funding that makes
  expeditions worth mounting. It wants what an expedition carried back.
- **The industry** transforms what the world yields: refinement, equipment, crafting, and the
  enhancement of avatars among its trades. It wants raw material from expeditions — and proof of how
  its work held up in the field. The crafting screens are its artifacts.

Each institution owns the screens that express it: a major screen reads as an artifact of the
institution behind it, so each feels distinct and inhabited. These are thematic anchors: downstream
notes attach mechanics to them as they need a licensor, a market, or a fabricator, and institution
names follow the world's naming grammar. Institutions carry player alignment and perks; a downstream
note owns that design.

Respite's landmarks are the places the home screen shows, and each landmark is the home of one game
system:

| Landmark              | Institution                    | System                        |
| --------------------- | ------------------------------ | ----------------------------- |
| The gates             | The authority over the outside | Expeditions                   |
| The library           | The authority over the outside | The codex                     |
| The market            | The market                     | Trade between players         |
| The bank              | The market                     | Storage of items and currency |
| The artisans' quarter | The industry                   | Crafting                      |
| The arena             | None                           | Ladders and PvP               |
| The guild halls       | None                           | Guilds                        |

The artisans' quarter gathers the forge, the leatherworker, and the tailor. The gates stand at the
edge of the city and face outward, so the paths on the world map begin where the city ends.

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

Regions become harder and stranger the farther they lie from Respite along the paths.

### Familiar Fantasy

Vers is fantasy built from concepts a player already knows: gods, elements, planes, bloodlines,
guilds, and a crossroads city. A player reads a region, an enemy, or an item at a glance, because
each one draws on a familiar idea rather than an invented taxonomy. Where a familiar fantasy word
exists, the world uses it.

Familiar does not mean flat. Each region commits to one identity and carries it through its biome,
its enemies, and its damage mix.

### Competitive Expedition

Progress is measured by how far and efficiently avatars can push into the multiverse. Ladders and
PvP make that competition explicit, but the core pressure starts with the regions themselves.

## Naming Grammar

1. **Two registers.** System vocabulary (damage types, hit deliveries, defensive layers, the
   Azimuth) is clinical and stable — it lives in tables and logs. World vocabulary (places, gods,
   factions, enemies, items) is worn and human. Never swap them.
2. **Familiar words first.** A world name draws on a word a fantasy player already knows before the
   world invents one.
3. **Institutions are called what citizens call them**, never their charter name.
4. **Register bans.** No science-fiction or technology words in world vocabulary (`machine`,
   `signal`, `circuit`), and no console words (`root`, `admin`, `null`). Console words are fine in
   system vocabulary.

## Vocabulary Register

The register covers world vocabulary and cross-cutting terms. System vocabulary lives in
[attributes and damage model](./attributes-damage-model.md) and
[defensive archetypes](./defensive-archetypes.md).

| Term       | Status      | Notes                                                                                                 |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| Vers       | Keep        | Carries universe and versus: exploration of the multiverse plus competition.                          |
| avatar     | Canonical   | A mortal who carries a god's blood, shaped by the player and sent into dangerous regions.             |
| Respite    | Canonical   | The multicultural hub city at the center of the multiverse.                                           |
| multiverse | Keep        | The worlds the paths from Respite reach; the broad play space and fiction layer.                      |
| pantheon   | Canonical   | The gods whose blood avatars carry.                                                                   |
| bloodline  | Canonical   | The god whose blood an avatar carries; chosen at avatar creation and near-permanent.                  |
| Aether     | Canonical   | Divine blood, and the single avatar skill resource.                                                   |
| region     | Provisional | Neutral term for world-map areas.                                                                     |
| expedition | Provisional | The core activity: outfit an avatar, send it out, recover what returns.                               |
| loot       | Keep        | Core ARPG promise.                                                                                    |
| power      | Keep        | Umbrella term for rewards that help the player push farther or more efficiently.                      |
| commitment | Provisional | UI label for a build's distance from center; prose uses committed and centered as plain descriptions. |
| glyph      | Not canon   | Visual candidate; no world rule uses it.                                                              |

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
- **Fiction** — institution names, region and biome identities, and the economy modes' world names.
- **Pantheon** — the gods, what each bloodline grants, and the cost of changing a bloodline.
- **Institutions and alignment** — alignment mechanics and perks.
