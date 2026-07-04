## Monorepo layout

26 projects live under `projects/*` (the sole bun workspace glob). Every project has its own
`package.json` named `@vers/<name>`: internal deps use the `workspace:*` protocol, and versions
shared by 5+ projects live in the root manifest's `workspaces.catalog` (referenced as `catalog:`).
Libraries are consumed as TypeScript source (`exports` → `./src/index.ts`); there are no per-library
build steps. `bun install` uses the isolated linker (pnpm-style symlinks, no phantom deps) with
exact pins and a 7-day `minimumReleaseAge` — see `bunfig.toml`. nx still drives the task graph —
`nx run-many` for build/typecheck/e2e/codegen, `nx affected` in CI for changed-project detection,
`nx.json` wiring the `@nx/vite` plugin and per-target caching. See `docs/000-overview.md` for the
project list and what each one is.

## Running things today

- `bun install` — installs the whole workspace (`--frozen-lockfile` in CI; `bun.lock` is
  committed).
- `bun run typecheck` — `nx run-many -t typecheck` (per-project `tsc --noEmit`); a single project
  via `bun run typecheck:<project>`.
- `bun run test` — `vitest` from the repo root (project-scoped via `bun run test:<project>`;
  vitest project names are the package names, e.g. `vitest --project @vers/service-api`).
  Postgres-backed suites need `bun run pg:test-container:start` first.
- `bun run lint` — `tsx scripts/lint.ts`, a wrapper that shells out to `eslint` over `projects/`
  and `scripts/` (`--fix` via `bun run lint --fix`). Run through `bun run` (not raw `tsx`) so
  `node_modules/.bin` is on `PATH`.
- `bun run format` / `bun run format --check` — `tsx scripts/format.ts`, a wrapper that shells out
  to `prettier`.
- `bun run build` — `nx run-many -t build`; `bun run build:<project>` for a single one.
- `bun run e2e` — `nx run-many -t e2e` (Playwright, `app-web-e2e`).

## Tooling migration in progress

See #160 for the full phase plan (turborepo + bun, spike-gated; shared configs and AGENTS.md from
`zgeoff/tools`). This repo is mid-migration — several claims in `agents/shared.md` above describe
the _target_ state, not this repo yet:

- **oxlint/oxfmt** — not adopted. Linting and formatting still run through eslint (`eslint.config.js`
  family) and prettier, invoked via `scripts/lint.ts` / `scripts/format.ts`. Lands in #188.
- **lefthook** — not adopted. Git hooks are still husky + lint-staged (`.husky/`), minimally
  adapted to invoke bun. Lands in #189.
- **`bun test`** — not adopted. bun is the package manager and script runner only; all
  unit/integration tests run under vitest on node. Deferred past #160 to the rebuild (#163) —
  vitest stays until services move to the bun runtime.
- **nx** — still in place for the task graph (re-enabled deliberately for affected-project
  detection); turborepo replaces it in #186, after which the Dockerfiles also move to `turbo prune`
  instead of building from the whole-repo base image.

Don't "fix" these to match the shared partial mid-migration — follow the phase plan in #160 instead.
