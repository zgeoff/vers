# Defensive Archetypes

This note defines the forms of the damage model's defensive layers and the structure of play they
defend inside. Defensive identity in Vers is emergent: an archetype is a recognized pattern of layer
investment, never an enforced kit. Defensive stats compete for the shared gear and passive budget,
and each layer answers a different threat profile, so redundant stacking wastes budget and mixing
against a region's profile is always a real decision.

## Hit Deliveries

Every hit carries a delivery:

- **Strike** — contact: blows, blades, grapples, rams.
- **Projectile** — a traveling object: rounds, thrown mass, launched fragments.
- **Direct** — delivered without a travel vector: signal, lock, imposition. Direct hits cannot be
  avoided or intercepted.
- **Area** — a detonation across a space: explosions, shockwaves, eruptions. Area hits cannot be
  avoided or intercepted.

Persistent damage is not a hit and has no delivery.

Strange damage lean direct: Cognitive and Null arrive mostly as impositions rather than objects. A
region or enemy family's delivery profile characterizes it as strongly as its damage mix, and both
appear in its fingerprint.

| Layer       | Strike | Projectile | Direct | Area | Persistent |
| ----------- | ------ | ---------- | ------ | ---- | ---------- |
| Evasion     | ✓      | —          | —      | —    | —          |
| Dodge       | —      | ✓          | —      | —    | —          |
| Block       | ✓      | —          | —      | —    | —          |
| Deflect     | —      | ✓          | —      | —    | —          |
| Armour      | ✓      | ✓          | ✓      | ✓    | ✓          |
| Resistances | ✓      | ✓          | ✓      | ✓    | ✓          |
| Barrier     | ✓      | ✓          | ✓      | ✓    | ✓          |

## Avoidance: Evasion & Dodge

Avoidance fully negates a hit before it connects. **Evasion** applies to strike hits; **Dodge**
applies to projectile hits.

Both forms are chance-shaped and smoothed: realized avoidance tracks stated avoidance without lucky
or unlucky streaks, so an unattended avatar's survival never rests on a roll sequence. Avoidance
thins a hit stream in proportion to its volume — it is strongest against many small hits and
contributes least against a single decisive one.

## Interception: Block & Deflect

Interception spends a charge to reduce a connecting hit. **Block** intercepts strike hits;
**Deflect** intercepts projectile hits.

Both forms draw on one shared charge pool. Pool capacity and refill rate are shared investment;
trigger chance and the amount mitigated are invested per form. Trigger chance is smoothed like
avoidance. Interception reduces at baseline — full negation is the ceiling of deep investment, not
the default.

Charge economics bound interception without a cap: refill rate against enemy hit rate limits how
much of a stream can be intercepted. Sparse heavy hitters meet a charge on every swing; dense fast
streams drain the pool and land past it. Interception is strongest against few large hits and
weakest against volume — the inverse of avoidance, so the two compose instead of stacking: avoidance
thins the stream, interception catches the haymakers.

## Armour

Armour is Physical mitigation. Its reduction scales inversely with the size of the incoming hit:
small hits are mostly absorbed, massive hits punch through. Armour erases chaff and fades against
giants — the mirror of interception, and the pairing that lets a committed defender cover the full
hit-size spectrum.

## Resistances

Resistances are the six type-specific mitigations, capped, specced against a region's damage mix.
With Life, they are the deterministic floor: baseline content is tuned so resistances and Life alone
survive it, and every avoidance and interception stat is elective headroom. Direct and area hits are
answered here.

## Barrier

Barrier is the pool consumed before Life. Its native recovery is **recharge**: after a delay without
taking a hit, Barrier refills rapidly until touched again. Investment is pool size, recharge delay,
and recharge rate.

Barrier regeneration exists at a base of zero: steady per-beat recovery is bought as its own
percent-based investment, and without that investment no amount of scaling produces any.

Barrier is the tempo layer: it favors fights that grant untouched windows and degrades under
relentless pressure. Dense encounters and persistent damage are anti-Barrier by nature.

## Buffer

Buffer defers damage: a portion of a qualifying hit lands as decaying damage over the following
beats instead of instantly. Deferral converts spikes into pressure that recovery can answer — the
counterpart to interception, which removes spike damage rather than smearing it. Which hits qualify,
how much defers, and the decay rate are combat-note territory.

## Life & Recovery

Life is the final pool; reaching zero ends the activity under the defeat rules of the core note.

Recovery styles are separate investments, never one stat:

- **Regeneration** — steady per-beat recovery of a pool.
- **Leech** — recovery from damage dealt, invested separately for Life, Barrier, and Reserve.
- **On-intercept effects** — recovery or charge economy triggered by a successful Block or Deflect.
- **Encounter-start effects** — recovery or resources granted at the start of every encounter after
  an activity's first. This is the only between-fight recovery in the game.

## Activities & Encounters

The activity is the unit of play, and progression, region, and skill design inherit this structure.
An avatar enters an activity at full state and resets to full state between activities. Inside an
activity, encounters chain with no time between them: each encounter begins immediately, seeded with
the avatar's carried state.

Across an encounter boundary, pools keep their values; buffs, debuffs, statuses, and cooldown
progress persist; beat alignment resets. Nothing else restores. Encounters are therefore
independently simulable from their entry state, and reporting can resolve per encounter.

Two dials price defense:

- **Encounter count** prices sustain: short activities reward per-encounter survival, long chains
  reward leech, regeneration, and encounter-start investment.
- **Encounter density** — monsters per encounter — prices hit volume: dense packs feed avoidance and
  armour, sparse elites feed interception.

Carried debuffs make persistent-leaning regions genuinely attritional; that is their identity, not a
tuning accident.

## Compass Interaction

Compass position gates identity equipment on every axis, defensive pieces included. No Compass
position scales a defensive layer directly. Melee-side builds live in strike delivery and lean on
Evasion and Block; ranged-side builds live in projectile exposure and lean on Dodge and Deflect;
Altered-side builds lean on Barrier. Equipment bases that carry layer identities are an option the
itemisation note may take up, not a rule here.

## Non-Goals

This note does not define avoidance or interception math, smoothing functions, the armour curve,
recharge timings, buffer ratios, resistance cap values, or enemy layer distributions. Formulas
belong to the combat note; enemy distributions to the enemy-families note; single-target-versus-
area spread and burst-versus-sustain endurance are equipment and skill properties owned by the
itemisation and skills notes.
