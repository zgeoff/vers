## Monorepo layout

27 projects live under `projects/*` (declared as the sole yarn workspace glob). Today that's yarn 4
in PnP mode plus nx for the task graph — `nx run-many`/`nx affected` drive build, typecheck, e2e,
and codegen; `nx.json` wires the `@nx/vite` plugin and per-target caching. Only `app-web` has its
own `package.json` (needed for its own `react-router build`); every other project's dependencies
live in the single root `package.json`, which nx's project graph still splits per `projects/*`
directory. See `docs/000-overview.md` for the project list and what each one is.

## Running things today

- `yarn typecheck` — `nx run-many -t typecheck` (per-project `tsc --noEmit`); a single project via
  `yarn typecheck:<project>`.
- `yarn test` — `vitest` from the repo root (project-scoped via `yarn test:<project>`, e.g.
  `vitest --project service-api`). Postgres-backed suites need `yarn pg:test-container:start` first.
- `yarn lint` — `tsx scripts/lint.ts`, a wrapper that shells out to `eslint` over `projects/` and
  `scripts/` (`--fix` via `yarn lint --fix`).
- `yarn format` / `yarn format --check` — `tsx scripts/format.ts`, a wrapper that shells out to
  `prettier`.
- `yarn build` — `nx run-many -t build`; `yarn build:<project>` for a single one.
- `yarn e2e` — `nx affected -t e2e` (Playwright, `app-web-e2e`).

## Tooling migration in progress

See #160 for the full phase plan (turborepo + bun, spike-gated; shared configs and AGENTS.md from
`zgeoff/tools`). This repo is mid-migration — several claims in `agents/shared.md` above describe
the *target* state, not this repo yet:

- **oxlint/oxfmt** — not adopted. Linting and formatting still run through eslint (`eslint.config.js`
  family) and prettier, invoked via `scripts/lint.ts` / `scripts/format.ts`. Lands in #188.
- **lefthook** — not adopted. Git hooks are still husky + lint-staged (`.husky/`). Lands in #189.
- **`bun test`** — not adopted. All unit/integration tests run under vitest; there is no bun runtime
  in this repo yet. Deferred past #160 to the rebuild (#163) — vitest stays until services move to
  the bun runtime.
- **Exact-pin catalog** — dependency versions in the root `package.json` are already pinned exact
  (no `^`/`~`), but there is no workspace `catalog:` mechanism: only `app-web` has its own
  `package.json`, so there's nothing yet for other projects to reference a catalog from. Per-project
  `package.json` + catalog lands with the workspace foundation in #185.
- **nx** — still in place for the task graph (re-enabled deliberately for affected-project
  detection); turborepo replaces it in #186, after the workspace foundation.

Don't "fix" these to match the shared partial mid-migration — follow the phase plan in #160 instead.
