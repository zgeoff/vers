# vers documentation

## Architecture

How the platform is built — system design, data flows, and operational wiring.

- [Overview](./overview.md) — system architecture, request path, and the full project map
- [Auth](./auth.md) — sessions, step-up 2FA, OTP/TOTP verification, and service-to-service tokens
- [Service contracts](./service-contracts.md) — contract-first oRPC mechanics and change discipline
- [Error handling](./error-handling.md) — error taxonomy, bespoke-code registry, and the reporting
  split
- [Database](./database.md) — Neon postgres topology, connection rules, and re-provisioning
- [Deployment](./deployment.md) — Fly rollouts, container builds, CI wiring, and secrets
- [Service providers](./service-providers.md) — the external services and what each one owns
- [Feature flags](./feature-flags.md) — OpenFeature registry, resolution, and route gating
- [Game rendering](./game-rendering.md) — the persistent three.js canvas and scene state

## Game design

The game's design language and systems, numbered in reading order.

- [Core themes and world fiction](./game-design/001-core-themes-world-fiction.md)
- [Attributes and damage model](./game-design/002-attributes-damage-model.md)
- [Defensive archetypes](./game-design/003-defensive-archetypes.md)
