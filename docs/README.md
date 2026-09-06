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
- [Feature flags](./architecture/services/feature-flags.md) — OpenFeature registry, resolution, and
  route gating
- [Service providers](./architecture/services/service-providers.md) — the external services and what
  each one owns

### Platform

- [Database](./architecture/platform/database.md) — Neon postgres topology, connection rules, and
  re-provisioning
- [Queues](./architecture/platform/queues.md) — pg-boss behind `@vers/jobs`, the drain delivery
  model, and retry/idempotency rules
- [Deployment](./architecture/platform/deployment.md) — Fly rollouts, container builds, CI wiring,
  and secrets
- [Observability](./architecture/platform/observability.md) — OpenTelemetry metrics and traces, the
  instrument registry, and what the monitors watch
- [Chrome DevTools MCP](./architecture/platform/chrome-devtools-mcp.md) — agent access to a real
  Windows Chrome from WSL, and the port bridge that makes it reachable
- [Serena MCP](./architecture/platform/serena-mcp.md) — the shared read-only symbol-lookup daemon
  every agent session connects to, and why it serves the primary checkout
- [QA inbox](./architecture/platform/qa-inbox.md) — reading verification codes and links from email
  sent to a `qa.versidle.com` address during manual QA against production

### Game

- [Game simulation](./architecture/game/game-simulation.md) — the deterministic client sim,
  checkpoint streams, and replay verification
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
- [Game rendering](./architecture/game/game-rendering.md) — the persistent three.js canvas and scene
  state

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
