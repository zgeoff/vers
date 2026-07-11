# Economy Modes & Reward Integrity

This note defines how Vers keeps a fair player economy when the simulation runs on the player's
machine: the mode chosen at avatar creation, the rule for which rewards may be predictable, and
juice's economic role. The entropy architecture doc owns the mechanisms; this note owns the design
they enforce.

## Perfect Foresight

Vers simulates on the client, deterministically. That is what makes idle play free to run and
offline progress possible — and it means a motivated player can compute their own future: simulate
the runs ahead, see what drops, and choose which futures to play. This cannot be prevented, only
priced.

Foresight is harmless when outcomes are steady and devastating when they are rare: a player who can
scan thousands of regions for the one future holding a great roll gets that roll's value without
playing for it, and a market lets them sell it. The economy's one hard rule follows:

**An outcome may be predictable, or it may reach the market — never both.**

## The Mode Choice

Every avatar chooses its economy at creation:

- **Trade** (working label) — full market access. Itemized drops come from sealed-entropy content,
  which resolves online; predictable play — including the whole offline loop — yields progression
  and static materials.
- **Self-Found** (working label) — the whole game, fully offline, juice included. Nothing the avatar
  earns can ever be traded, gifted, or moved to another avatar. Foresight is legitimate texture:
  planning around a computed future is the mode's own kind of mastery.

The choice is permanent. A self-found avatar's wealth was accumulated under perfect foresight, so
migrating it into a market would launder foresight-selected value; permanence is the price of
unrestricted offline play. Both labels follow the naming grammar in the core note before they reach
the UI.

Mode is an avatar property, and avatars are league-scoped, so league resets contain self-found
holdings with no extra rule.

## Predictable Rewards

Rewards earned on predictable entropy are generic and static-class:

- **Experience.** Per-encounter variance is acceptable — foreseeing it only improves routing, which
  is calculator play, not arbitrage.
- **Fixed material and currency trickles** at published rates.
- **Completion payouts** — first-clear bonuses and unlock grants, fixed per region.

Itemized drops are never predictable for a trade avatar. A drop only means something when its roll
does, and a foreseeable roll is a roll the whole map gets scanned for — so there is no capped-tail
compromise version of a monster drop. Drops whose rolls matter exist only behind sealed entropy, or
on self-found avatars, where they are unrestricted everywhere.

This gives a trade avatar's play a deliberate rhythm: predictable play — base expeditions, the
offline loop — is the progression engine, and sealed-entropy sessions are the loot engine. The grind
builds the avatar; the sessions produce the finds.

## Juice

Juice is spending to modify an expedition instance, and for trade avatars it is the variance faucet:
commit the spend, craft against the preview's metadata, lock in, and the sealed outcome resolves.
Its constraints hold regardless of how juice mechanics evolve:

- Juiced rewards are a separable overlay — never a multiplier on a quantity the player could
  foresee. A multiplier on foreseeable value invites scanning for the best base outcome and
  amplifying it; the overlay form has nothing to scan.
- Difficulty conditions on the chosen tier alone, with flat expected value per cost across tiers.
- A juiced bundle settles all-or-nothing, and a committed instance always resolves — bailing
  forfeits the bundle, so peeking-then-declining has zero option value.
- Juiced failure costs only the forgone yield, never experience.

Self-found juice runs anywhere, offline included, on predictable entropy — its outputs are bound
like everything else the avatar earns.

## Extraction & Settlement

Progress and yield render instantly; verification is latency, not a gate on play. Extraction — the
core note's mid-run banking policy — is where the economy's gate sits: extracted yield joins the
avatar's holdings immediately, but for a trade avatar it leaves the account (trade, market, guild)
only once the checkpoints that produced it verify. Opening a trade bumps the player's unverified
checkpoints to the front of the verification queue, so honest players feel a brief gate exactly when
they transfer and nowhere else.

Experience and levels are never tradeable, render optimistically, and reconcile lazily. Defeat costs
follow the core note.

## Competition

- Ladders partition by mode: self-found avatars rank among self-found avatars.
- Guild banks hold tradeable goods, so only trade avatars deposit.
- Ghost PvP is build against build, and mode partitioning follows the ladders.

## Non-Goals

This note does not define reward tables or rates, juice mechanics and costs, drop design, ladder
structure, guild mechanics, offline caps per mode, or the modes' world names. Those belong to the
progression, itemisation, economy-loop, and fiction notes.
