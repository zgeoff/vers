# Economy Modes & Reward Integrity

This note defines how Vers keeps a fair player economy when the simulation runs on the player's
machine: the mode chosen at avatar creation, the rules for which outcomes may be predictable, and
juice's economic role. The entropy architecture doc owns the mechanisms; this note owns the design
they enforce.

## Perfect Foresight

Vers simulates on the client, deterministically. That is what makes idle play free to run and
offline progress possible — and it means a motivated player can compute their own future: simulate
the runs ahead, see what happens, and choose which futures to play. This cannot be prevented, only
priced.

Foresight is harmless when outcomes are steady and devastating when they are rare: a player who can
scan thousands of regions for the one future holding a great roll gets that roll's value without
playing for it, and a market lets them sell it. The economy's one hard rule follows:

**An outcome may be predictable, or it may reach the market — never both.**

## The Mode Choice

Every avatar chooses its economy at creation, and the choice is a single fact: who holds the
avatar's loot key.

- **Trade** (working label) — full market access. The avatar's loot key stays on the server, so
  drops resolve as the run's records land: live while connected, and in one reveal on returning from
  offline. The same expedition yields the same loot either way — being away changes when loot is
  seen, never what it is worth.
- **Self-Found** (working label) — the avatar's loot key lives with the player, so loot resolves
  locally, offline, in real time, juice included. Nothing the avatar earns can ever be traded,
  gifted, or moved to another avatar. Foresight is legitimate texture: planning around a computed
  future is the mode's own kind of mastery.

Trade is the default and the pre-selected choice at creation. Self-Found is a deliberate opt-in
behind an explicit warning, because the choice is permanent: a self-found avatar's wealth was rolled
under a key its player holds — accumulated under perfect foresight — so migrating it into a market
would launder foresight-selected value. Permanence is the price of a key of one's own. A new player
who never touches the market loses nothing by staying Trade; only Self-Found forecloses anything.

The mode difference carries its own fiction: the market institution assays and logs a trade avatar's
finds — that is why they take a moment to appear and why they can be sold — while a self-found
avatar's haul is off the books, never assayed, kept in its own hands. Both labels follow the naming
grammar in the core note before they reach the UI.

Mode partitions every economic container and every reward-bearing space, as a standing invariant
rather than a list: stashes, banks, ladders, prize events — anything that stores value or pays it
out is scoped to one mode, and no container is ever shared across the boundary, including between
one account's own avatars. Self-found ladders rank on server-verifiable play — depth, level, clear
speed — never on gear, which only the player's own device rolled. Avatars are league-scoped, so
league resets contain self-found holdings with no extra rule.

## Predictable Outcomes

The simulation's trajectory is predictable by design — offline play depends on computing it — so
everything the trajectory carries is priced for foresight:

- **Experience.** Per-encounter variance is acceptable — foreseeing it only improves routing, which
  is calculator play, not arbitrage.
- **Fixed material and currency trickles** at published rates.
- **Completion payouts** — first-clear bonuses and unlock grants, fixed per region.
- **Drop slots.** Which kills yield loot, and how many, is trajectory knowledge: foreseeing it
  reveals a route's throughput, never what any slot contains.

Because slot counts are foreseeable and every slot carries market value for a trade avatar, drop
density obeys the tail rule that drop quality no longer needs: routes may differ modestly in drops
per hour — grindy play averages out — but no route is a density jackpot worth scanning thousands of
futures to find. Density outliers belong in invested content, priced by their cost.

What a slot contains is never predictable for a trade avatar: content rolls under the server-held
key only after every choice that produced the slot is committed. Loot therefore drops everywhere —
base expeditions, invested expeditions, the offline loop — with full ordinary variance, and none of
it can be fished for.

Two consequences the wider economy design carries as obligations. Offline accrual is wall-clock
metered and non-resettable — an hour of absence yields an hour of progress, capped, with no way to
bank a window and immediately re-arm it — and because unattended play now mints market-grade loot,
per-account throughput limits and account-legitimacy gates at market access are economy-design
prerequisites, alongside sinks sized to a faucet that runs while players sleep. The economy-loop
note owns them.

## Juice

Juice is spending to modify an expedition instance. Where its randomness lives follows the tail
rule, not the mechanic:

- **Tiers and instance modifiers** — choose a tier, roll and reroll the instance's modifiers, lock
  in. Modifier outcomes are normalized by design: bounded scalars on difficulty and yield, no
  jackpot combinations, never coupled to a reward tail. A tail-free distribution reveals nothing
  worth selecting, so instance rolling is client-trustable and works anywhere, offline included,
  rerolls and all. Keeping modifiers jackpot-free is a standing content constraint, the same
  obligation as drop density.
- **Item crafting** — affix rolls are the tail; shaping items is the point. Crafting rolls draw
  sealed server entropy behind the preview flow, online. Self-found avatars craft against their own
  key — nothing is sealed from them, and nothing they make can leave.

Base drops fall everywhere; juice is deliberate investment layered on top, and item crafting is the
targeted-outcome market — shaping what kind of reward play can produce — beside base play's open
lottery, its costs a real consumption of wealth. The constraints hold regardless of how juice
mechanics evolve:

- Juiced rewards are a separable overlay — never a multiplier on a quantity the player could
  foresee. A multiplier on foreseeable value invites scanning for the best base outcome and
  amplifying it; the overlay form has nothing to scan.
- Difficulty conditions on the chosen tier alone, with flat expected value per cost across tiers.
- A sealed craft settles all-or-nothing, and a committed craft always resolves — bailing forfeits
  the bundle, so peeking-then-declining has zero option value.
- Juiced failure costs only the forgone yield, never experience.

## Extraction & Settlement

Progress and yield render instantly; verification is latency, not a gate on play. Extraction — the
core note's mid-run banking policy — is where the economy's gate sits: extracted yield joins the
avatar's holdings immediately, but for a trade avatar it leaves the account (trade, market, guild)
only once the checkpoints that produced it verify. Opening a trade bumps the player's unverified
checkpoints to the front of the verification queue, so honest players feel a brief gate exactly when
they transfer and nowhere else.

The verification gate follows value through transformation: an output crafted, salvaged, or combined
from an unverified input inherits the gate until every contributing input verifies. Item crafting
that consumes tradeable currency rolls server-side — the tail rule is the same boundary everywhere —
and applies exactly once per action.

Experience and levels are never tradeable, render optimistically, and reconcile lazily. Defeat costs
follow the core note, with one constraint from foresight: survival is trajectory knowledge, so a
player who plans can avoid nearly every death — death is a texture cost, and the economy never
relies on it as a sink or a throughput brake.

## Competition

- Ladders, prize events, and every future reward-bearing space partition by mode — the standing
  invariant from the mode choice.
- Guild banks hold tradeable goods, so only trade avatars deposit.
- Ghost PvP is build against build, and mode partitioning follows the ladders.
- Group content resolves loot personally: each participant rolls shared encounters under their own
  key, so a mixed-mode party yields each member their own mode's loot and no shared pool exists.

## Non-Goals

This note does not define reward tables or rates, juice mechanics and costs, drop design, ladder
structure, guild mechanics, offline caps per mode, sink and throughput-limit design (the
economy-loop note owns them), or the modes' world names. Those belong to the progression,
itemisation, economy-loop, and fiction notes.
