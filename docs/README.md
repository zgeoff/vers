<div align="center">
  <h1>vers documentation</h1>

  <p>Platform documentation for the vers system.</p>

  <p>
    <a href="./architecture/overview.md">Architecture</a> •
    <a href="./game-design/001-core-themes-world-fiction.md">Game Design</a> •
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
- [Deployment](./architecture/deployment.md) — Fly rollouts, container builds, CI wiring, and
  secrets
- [Service providers](./architecture/service-providers.md) — the external services and what each one
  owns
- [Feature flags](./architecture/feature-flags.md) — OpenFeature registry, resolution, and route
  gating
- [Game rendering](./architecture/game-rendering.md) — the persistent three.js canvas and scene
  state

## Game design

The game's design language and systems, numbered in reading order.

- [Core themes and world fiction](./game-design/001-core-themes-world-fiction.md)
- [Attributes and damage model](./game-design/002-attributes-damage-model.md)
- [Defensive archetypes](./game-design/003-defensive-archetypes.md)
