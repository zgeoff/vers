<div align="center">
  <h1>vers</h1>

  <p>
    A browser idle game on a microservice backend: a deterministic simulation runs on the client,
    and the server verifies its results by replay.
  </p>

  <p>
    <a href="./docs/README.md">Documentation</a> •
    <a href="./docs/architecture/overview.md">Architecture</a> •
    <a href="./AGENTS.md">Agent Guidelines</a>
  </p>
</div>

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

- For a map of the architecture and every workspace project, read
  [docs/architecture/overview.md](./docs/architecture/overview.md).
- Follow the engineering conventions in [AGENTS.md](./AGENTS.md).
- Deploys run through `bun run deploy`. For the details, read
  [docs/architecture/platform/deployment.md](./docs/architecture/platform/deployment.md).
