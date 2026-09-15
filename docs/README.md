<div align="center">
  <h1>vers documentation</h1>

  <p>Platform documentation for the vers system.</p>

  <p>
    <a href="./architecture/overview.md">Architecture</a> •
    <a href="./game-design/core-themes-world-fiction.md">Game Design</a> •
    <a href="../AGENTS.md">Agent Guidelines</a>
  </p>
</div>

---

## Architecture

How the platform is built — system design, data flows, and operational wiring.

- [Overview](./architecture/overview.md) — system architecture, request path, and the full project
  map
- [Analytics](./architecture/analytics.md) — the web/product analytics split, funnel events, and the
  privacy stance

### Services

- [Auth](./architecture/services/auth.md) — sessions, step-up 2FA, OTP/TOTP verification, and
  service-to-service tokens
- [Service contracts](./architecture/services/service-contracts.md) — contract-first oRPC mechanics
  and change discipline
- [Error handling](./architecture/services/error-handling.md) — error taxonomy, bespoke-code
  registry, and the reporting split
- [Rate limits](./architecture/services/rate-limits.md) — app-web's request budgets by tier and the
  session-keyed rpc budget
- [Feature flags](./architecture/services/feature-flags.md) — OpenFeature registry, resolution, and
  route gating
- [Service providers](./architecture/services/service-providers.md) — the external services and what
  each one owns

### Platform

- [Database](./architecture/platform/database.md) — Neon postgres topology and connection rules
- [Queues](./architecture/platform/queues.md) — pg-boss behind `@vers/jobs`, the drain delivery
  model, and retry/idempotency rules
- [Deployment](./architecture/platform/deployment.md) — Fly rollouts, container builds, CI wiring,
  and secrets
- [Observability](./architecture/platform/observability.md) — OpenTelemetry metrics and traces, the
  instrument registry, and what the monitors watch

### Game

- [Game simulation](./architecture/game/game-simulation.md) — the deterministic client sim, activity
  starts, and checkpoint streams
- [Seed chain](./architecture/game/seed-chain.md) — the forward sequence of positions each activity
  draws from: where a chain starts, how its two anchors move, and what a rejection undoes
- [Offline reconcile](./architecture/game/offline-reconcile.md) — how progress made without the
  server is delivered, checked, and settled in play order on reconnect
- [Game entropy](./architecture/game/game-entropy.md) — entropy sources, sealed salt, and reward
  provenance
- [Item generation](./architecture/game/item-generation.md) — the entropy-agnostic interpreter that
  turns a digest into item content: roll streams, versioned tables, craft constraints
- [World map](./architecture/game/worldmap.md) — the per-avatar infinite graph: public hex-lattice
  geometry, server-sealed content, reveal projection, and biome terrain
- [Replay verification](./architecture/game/replay-verification.md) — the queue-fed verifier,
  settlement, and the sim-version registry that keeps old engine builds replayable
- [Game rendering](./architecture/game/game-rendering.md) — the persistent three.js canvas and scene
  state
- [Glossary](./architecture/game/glossary.md) — the terms the game docs share, each defined once

## Runbooks

Procedures an operator or an agent runs by hand.

- [Provisioning](./runbooks/provisioning.md) — stand the Fly fleet, the Neon project, and agent
  database access up from nothing, and tear them down
- [Dev database](./runbooks/dev-database.md) — local migrations, Neon branches for experiments, and
  the per-worktree clones MCP sessions use
- [Manual QA](./runbooks/qa.md) — QA accounts, the inbox, the browser tools, the debug hook, and the
  cold-path script for a manual pass against production

## Game design

The game's design language and systems.

- [Core themes and world fiction](./game-design/core-themes-world-fiction.md) — the world's pillars,
  tone, factions, and the vocabulary every other note inherits
- [Attributes and damage model](./game-design/attributes-damage-model.md) — damage types, the
  Azimuth attribute system, and the defensive-layer structure
- [Defensive archetypes](./game-design/defensive-archetypes.md) — the emergent defensive layers and
  the activity/encounter structure they defend inside
- [Economy modes and reward integrity](./game-design/economy-modes.md) — economy modes and the
  reward-design rules
- [Crafting entropy](./game-design/crafting-entropy.md) — sealed pre-commit salt, craft positions,
  and item lineage
- [Base classes](./game-design/base-classes.md) — a class as a signature mechanic, the class-design
  laws, and the specialization model
- [Base class template](./game-design/base-class-template.md) — the fill-in sheet for speccing a
  single class against the base-class model
