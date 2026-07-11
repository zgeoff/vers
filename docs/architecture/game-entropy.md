# Game entropy & provenance

Where game randomness comes from, and how an entropy source's security properties decide what
rewards may ride it.

## Threat model

The client is untrusted and holds the complete simulation, so any entropy the client can compute is
entropy the player can peek: simulate the future, inspect the outcome, and choose whether — and
where — to play it. Look-ahead cannot be prevented in a deterministic client-simulated game;
anything the client can describe, it can pre-compute. The design prices look-ahead instead of
chasing it.

The quantity that matters is selection value, and it is an order statistic: a scanner takes the best
future across every reachable node and the whole offline window, so a reward distribution's danger
lives in its tail, not its variance. Modest per-run variance with a rare outlier still hands a
scanner a jackpot, because best-of-twenty-thousand lives in the tail. The
[economy modes note](../game-design/004-economy-modes.md) turns this into the reward-design rule.

## The anchored seed chain

Per `(avatar, node)`, the server anchors an append-only seed chain: the next run's seed derives
deterministically from the stored end of the previous run at that node. Abandoning and restarting
yields the same continuation — there is nothing to re-roll. This single rule closes seed-fishing,
death-scumming via early flush, and retry-branch selection.

The chain is client-computable by design — offline simulation depends on it — which makes every
chain-seeded run peekable. Chain entropy therefore carries only rewards priced for perfect
foresight.

## Sealed server salt

Runs whose rewards must be unpeekable draw their entropy from server-minted salt, revealed in two
commits:

1. **Commit.** The player locks in (spends, selects a tier). The server mints the salt from a
   server-held secret key and stores it sealed, returning only a lossy derived projection — mods,
   difficulty, reward budget — for the preview window. All crafting decisions happen against that
   metadata; the client never holds simulatable entropy while a decision is open.
2. **Run-commit.** The salt is released and the client simulates. Release is commitment: the
   position resolves under that salt, and a committed position the client never resolves is
   force-resolved server-side at a deadline inside the replay-retention window, so an abandoned
   commit cannot gate its node forever.

The salt's keying material is a server-held secret. Domain-separation labels alone are insufficient:
salt derived from client-visible state under a different label is still client-computable, and the
entire unpeekability property collapses.

Salt is minted once per chain position and re-fetch is idempotent — a client that loses the response
retries and receives the same salt, so a lost packet cannot fork the timeline, and until the release
arrives the run simply does not start. The build snapshot pins at mint, so deferring resolution
cannot improve an outcome by out-leveling it first.

A sealed-salt run requires a live round trip, so sealed-salt content is online content.

## Provenance

Every reward-bearing outcome carries a typed provenance: the entropy source kind plus a tradeable
capability. The stamp derives at settlement from server mint records and the entropy-source
commitment inside the hashed checkpoint subset — never from a client claim — so provenance is
replay-derivable from the chain rather than trusted from a side table.

Tradeability keys on the security property — entropy unpredictable at commit and non-repudiable —
not on which channel delivered it. Any source with those properties mints tradeable outcomes;
sources without them mint bound ones.

## Mode enforcement

An avatar's economy mode (the [economy modes note](../game-design/004-economy-modes.md) owns the
choice) fixes its provenance statically:

- **Trade avatars** ride the anchored chain for base expeditions — carrying static-class rewards
  only — and sealed salt for itemized drops.
- **Self-found avatars** ride the anchored chain for everything, juice included, and every outcome
  settles bound.

No per-run provenance adjudication exists: no fallback converts one entropy source into the other
mid-run, so connectivity can never silently change what an outcome is worth.
