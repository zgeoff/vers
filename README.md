# vers

A browser idle game on a microservice backend: a deterministic simulation runs on the client, and
the server verifies its results by replay.

[Documentation](./docs/README.md) • [Architecture overview](./docs/overview.md) •
[Agent guidelines](./AGENTS.md)

## Quick start

```sh
bun install                       # whole workspace
bun run stack start               # full backend via docker compose
bun run dev:app-web               # web app dev server
bun run stack stop                # tear the backend down
```

## Checks

```sh
bun run typecheck
bun run test                      # postgres suites need: bun run pg:test-container:start
bun run lint
bun run format
bun run e2e                       # playwright; first run: bun playwright install
```

## Layout and conventions

- [docs/overview.md](./docs/overview.md) maps the architecture and every workspace project.
- [AGENTS.md](./AGENTS.md) holds the engineering conventions. It is generated from
  `agents/shared.md` and `agents/project.md` — edit the partials, never the file itself.
- Deploys run through `bun run deploy` — see [docs/deployment.md](./docs/deployment.md).
