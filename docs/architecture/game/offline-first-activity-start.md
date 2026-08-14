# Offline-first activity start

## Principle

The client always mints an activity start locally; the server never mints one. Starting a node is a
pure client computation over materials the client already holds, and the server's role reduces to
what it alone can do: anchor the chain, adjudicate concurrency, and verify the result. "Online" and
"offline" stop being two code paths — online means the submission lands immediately, offline means
it lands on reconnect. The path is one.

This is not a new trust model. The game is already client-optimistic and server-verified: the client
runs the simulation, derives the forward seed chain, folds an optimistic build, and submits
checkpoints; the replay verifier re-derives everything and confirms or rejects. Rewards already hold
as pending items until verification. Unifying the start removes the last piece that diverged from
that model — a synchronous server mint — and lets the verifier remain the single authority.

## What only the server can do

Three responsibilities stay server-side, and none of them requires a synchronous mint at start time:

- **Deliver the start materials.** A node's genesis seed is a server CSPRNG value and its encounter
  is derived from a scope secret that never leaves the server. Both reach the client through
  `revealNodes` and are cached (`node-seeds`, start stamps). A node never revealed cannot be started
  — you can only start what you can see.
- **Anchor the chain.** One `activity_chains` row per `(avatar, scope)` holds the appended anchor
  (`appended_next_seed`, `appended_chain_index`) and the verified anchor. A new activity roots at
  the appended anchor, and only one linear chain may exist. This is enforced with a compare-and-swap
  at submit time, not a lock at start time.
- **Verify.** The replay verifier re-derives the seed chain, re-derives the encounter from the
  sealed scope secret, recomputes the start hash, replays the simulation, settles xp, and mints
  first-clear grants — or rejects, rewinding the appended anchor to the verified anchor and voiding
  successors. It already reads every field a client-minted genesis would carry, so it catches a
  lying start with no change.

## The universal start

On selecting a node, the client synthesizes a full activity row from cached materials — no network:

- `seed` and `start_chain_index` from the chain's **current head**, cached per node and seeded from
  genesis at reveal (see [Rooting at the head](#rooting-at-the-head)).
- `encounter`, `content_version` from the `node-seeds` cache; `key_version`, `secret_ref`,
  `secret_version` from the cached start stamps; `sim_version` from the bundled engine hash.
- `start_hash` recomputed locally by `buildStartHash` (a pure hash over
  `[seed, sim_version, content_version, key_version, encounter]`; the row id is deliberately
  excluded).
- `build_snapshot` computed from the client's settled xp — a hint the server re-authors.
- a fresh client id `act_<cuid>`.

The row installs through the existing origin-agnostic path (`handleSetActivityMessage` →
`buildSimulationInput` → `registerActivity` → `simulation.startActivity`) and its checkpoints queue
through the existing durable submitter. The synthesized root is persisted to a durable pending-root
store so it survives reload until the server accepts it.

### Rooting at the head

Every start roots at the chain's appended head, which equals the genesis seed only on a node's
first-ever start. A node cleared before has an advanced head, so genesis is the wrong root for a
revisit. The client already computes the advancing head — the submitter's write cursor tracks the
next seed and index, and each checkpoint carries its own next seed deterministically — but it prunes
that state once the server confirms it. The unified model persists the head per node as it advances,
online or offline, so a later start reads the correct root. Genesis is simply the head's initial
value.

A head cached this way can be stale if another session advanced the chain. That is not corrected at
start time and does not need to be: the submit-time anchor check rejects a stale root, and the
verifier re-anchors, exactly as an online continuation conflict is handled today.

## Submit-time ingest

The submission that lands a client-minted start is the existing continuation batch widened to carry
a root. Where `advanceActivity` today reads the root row and returns `NOT_FOUND` when it is absent,
the unified ingest instead **mints the root** from the client-supplied start context, then appends
the batch — one call, one transaction, under the same avatar advisory lock and chain-row lock order.

The server does not trust the client's context; it re-derives and validates it:

- **Anchor check (the core gate).** The minted root's `seed`/`start_chain_index` are accepted only
  if the chain's live `appended_next_seed`/`appended_chain_index` still match what the client rooted
  against — the same compare-and-swap that guards an append (`update-appended-anchor-from-tail`). If
  the anchor moved, the whole batch is stale and the call returns a conflict.
- **Encounter re-derivation** from the sealed scope secret, **start-hash recomputation**, and
  **build-snapshot re-authoring** via `getOptimisticBuild` — a mismatch against the client hint is
  rejected, as `advanceActivity` already does for a minted successor.
- **Sim-version validation** (`resolveSimVersionStamp`), **quarantine** and **node-revealed** gates,
  and the **single-active-run** unique index — the work that lives in `startActivity` today, moved
  onto the root mint.

The append machinery, the anchor CAS, the meter debit, and the idempotency dedup are reused
unchanged. The only additions are the root-mint branch and the wider input schema: the continuation
wire shape carries only `{ build_snapshot, checkpoints, id, start_key }` today and must gain the
start context (`seed`, `encounter`, `content_version`, `sim_version`, `key_version`, `secret_ref`,
`secret_version`, `scope_type`, `scope_id`, `start_chain_index`, `start_hash`) for a root.

## The one hard change: concurrency becomes asynchronous

A local mint cannot know that another tab or device already holds the avatar's single active run.
Today `startActivity` answers that synchronously — a `CONFLICT` carrying the live row drives the
attach and replace flows. In the unified model the conflict is discovered at submit: the root mint
hits the single-active-run unique index and returns the live row, and the client resolves it **after
the fact** — attaching to or replacing the existing run on reconcile rather than before the player
begins.

This is the model's real cost. The player starts instantly and, in the rare genuine two-writer case,
the resolution arrives asynchronously. That trade is deliberate and reversible: if the asynchronous
conflict proves to hurt play, an individual start can be gated back behind a synchronous check
without disturbing the rest of the model. Nothing else about the design depends on the conflict
being synchronous.

The other synchronous verdicts — sim-version staleness, quarantine, avatar-not-active, node-not-
revealed — likewise move to the submit response. Their player-facing notices move with them to the
reconcile path.

## What is removed

- The client's `startActivity` RPC call (`tryStartActivity`) and its two-call sim-version fallback.
- The online/offline branch in the start handler and the connectivity gate that chose between them
  (the connectivity flag remains for flush scheduling).
- The synchronous `attached` outcome and the same-scope / different-scope replace flow, replaced by
  asynchronous conflict resolution at submit.
- Eventually, the server `startActivity` handler itself, once no caller remains.

## What is built

- A **server root-mint ingest** — the `advanceActivity` branch (or a sibling entry) that adopts a
  client-supplied root id, seed, and start hash, validating them against the live anchor and the
  sealed scope secret before appending.
- A **wider submission schema** carrying the start context for a root.
- A **client drain** that ships the durable pending-root store on reconnect and reconciles the
  client id and its queued checkpoints — nothing consumes that store today.
- An **asynchronous conflict path** replacing the synchronous attach/replace flow.
- **Per-node head persistence** feeding the universal root (see
  [Rooting at the head](#rooting-at-the-head)).

The verifier is unchanged.

## Migration

The work already merged is the substrate this model needs and is not wasted: `revealNodes` (#509),
the client seed cache (#894), and the encounter and start-stamp cache (#897) are exactly the
start-material delivery the client mints from.

The in-flight offline-start work (#890 / PR #903) is re-shaped rather than merged: its local
synthesis (`buildOfflineStartRow`), its durable pending-root store, and the origin-agnostic install
are the universal mint path; its online/offline branch and connectivity gate are dropped because the
path is now unconditional.

The remaining issues re-scope onto this model:

- **Universal client mint** — the start becomes a single unconditional local synthesis rooted at the
  cached head, persisted to the pending-root store. (Re-shaped #890.)
- **Server root-mint ingest and the submission schema** — the submit-time mint-then-append and its
  anchor validation. (The server half of reconcile, formerly split across #891.)
- **Client reconcile drain and asynchronous conflict** — shipping the pending root on reconnect and
  resolving conflicts after the fact. (The client half of reconcile, #891.)
- **Traversal validation** — the server rejects an append whose root enters a node not connected to
  a cleared one, sharing the selectability rule with the online reveal authorization. (#892 / #507.)
- **Offline traversal overlay** — clearing a node locally opens its neighbours for selection.
  (#899.)

## Open questions

- **Head-cache freshness across sessions.** A stale cached head produces a submit-time conflict, not
  corruption, but frequent multi-session play would make those conflicts common; whether that
  warrants a lightweight head refresh on reconnect is a tuning question, not a correctness one.
- **Retiring the server start.** The server `startActivity` handler stays until every caller is
  gone; the point at which it is deleted, versus left dormant, is a follow-up.
