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
- [Auth](./architecture/auth.md) — sessions, step-up 2FA, OTP/TOTP verification, and
  service-to-service tokens
- [Service contracts](./architecture/service-contracts.md) — contract-first oRPC mechanics and
  change discipline
- [Error handling](./architecture/error-handling.md) — error taxonomy, bespoke-code registry, and
  the reporting split
- [Database](./architecture/database.md) — Neon postgres topology, connection rules, and
  re-provisioning
- [Queues](./architecture/queues.md) — pg-boss behind `@vers/jobs`, the drain delivery model, and
  retry/idempotency rules
- [Deployment](./architecture/deployment.md) — Fly rollouts, container builds, CI wiring, and
  secrets
- [Service providers](./architecture/service-providers.md) — the external services and what each one
  owns
- [Feature flags](./architecture/feature-flags.md) — OpenFeature registry, resolution, and route
  gating
- [Game rendering](./architecture/game-rendering.md) — the persistent three.js canvas and scene
  state
- [Game simulation](./architecture/game-simulation.md) — the deterministic client sim, checkpoint
  streams, and replay verification
- [Game entropy](./architecture/game-entropy.md) — entropy sources, sealed salt, and reward
  provenance

## Game design

The game's design language and systems.

- [Core themes and world fiction](./game-design/core-themes-world-fiction.md) — the world's
  pillars, tone, factions, and the vocabulary every other note inherits
- [Attributes and damage model](./game-design/attributes-damage-model.md) — damage types, the
  Azimuth attribute system, and the defensive-layer structure
- [Defensive archetypes](./game-design/defensive-archetypes.md) — the emergent defensive layers
  and the activity/encounter structure they defend inside
- [Economy modes and reward integrity](./game-design/economy-modes.md) — economy modes and the
  reward-design rules
