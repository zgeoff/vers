## Monorepo layout

28 projects live under `projects/*` (the sole bun workspace glob). Every project has its own
`package.json` named `@vers/<name>`: internal deps use the `workspace:*` protocol, and versions
shared by 5+ projects live in the root manifest's `workspaces.catalog` (referenced as `catalog:`).
Libraries are consumed as TypeScript source (`exports` → `./src/index.ts`); there are no per-library
build steps. `bun install` uses the isolated linker (pnpm-style symlinks, no phantom deps) with
exact pins and a 7-day `minimumReleaseAge` — see `bunfig.toml`. Turborepo drives the task graph:
root `turbo.json` declares the `build`/`typecheck`/`test`/`codegen`/`typegen`/`e2e` pipelines
(ordering inferred from each project's `workspace:*` deps) plus a root `//#codegen:graphql` task for
the one codegen step that reads across packages (service-api's schema, app-web's documents).
Per-project `turbo.json` files exist only to declare `boundaries` tags. CI's changed-project
detection is `turbo run --affected`. See `docs/000-overview.md` for the project list.

TypeScript is 7.0.1-rc (catalog), which dropped `baseUrl` and the classic Compiler API entirely —
every project's tsconfig lost its `baseUrl`/`paths` block and every former `~/*` import is a
relative import instead. There is no path-alias convention here; write new imports relative to the
importing file. Node is 24.18.0 everywhere (CI, every service's Dockerfile, app-web's `engines`
field) — panda 2.0's floor and the ES2024 `lib` target both need it.

## Boundaries

Projects are tagged `lib`, `service`, or `app` in their own `turbo.json`; the root `boundaries`
block denies `lib` → `service`/`app` and `service` → `app` imports, transitively.
`bun run boundaries` also flags imports of packages missing from the importer's `package.json`. It
walks the filesystem, ignoring `.gitignore` — run it on a clean tree, or stale `dist/`/`build/`/
`styled-system/` output reads as source. CI runs it straight after install, before codegen populates
those directories.

### Package naming

Every importable workspace package lives in a `lib-`-prefixed folder. A package's name is its folder
name minus the taxonomy prefix: `lib-` and `app-` strip (`lib-validation` → `@vers/validation`,
`app-web` → `@vers/web`); `service-` and `db-` are part of the name and carry through
(`@vers/service-user`, `@vers/db-postgres`).

## Styling

Panda CSS is 2.0.0-beta.8 across all four consumers (lib-panda-preset, lib-styled-system,
lib-design-system, app-web) — no stable release exists yet, so the packages are pinned through
`bunfig.toml`'s `minimumReleaseAgeExcludes` with a removal issue tracking the jump to stable.
lib-panda-preset composes `presets: [presetBase, presetPanda]` from `@pandacss/preset-base` and
`@pandacss/preset-panda` (2.0 dropped the bundled `@pandacss/dev/presets` default). CSS values that
aren't theme tokens need the bracket escape hatch (`cursor: '[pointer]'`, `borderWidth: '[1px]'`) —
2.0 tightened `SystemStyleObject`'s value types to stop silently accepting arbitrary strings/numbers.

## Running things today

- `bun install` — whole workspace (`--frozen-lockfile` in CI; `bun.lock` is committed).
- `bun run typecheck` — `turbo run typecheck` (per-project `tsc --noEmit`); one project via
  `--filter=@vers/<name>`.
- `bun run test` — `turbo run test` (per-project `vitest run`); one project via `--filter`.
  Postgres-backed suites need `bun run pg:test-container:start` first.
- `bun run lint` / `bun run lint:fix` — `oxlint` over the whole tree (`.oxlintrc.json` at the root);
  not a turbo task, oxlint covers everything in one fast invocation.
- `bun run lint:type-aware` — `oxlint --type-aware --type-check` (oxlint-tsgolint underneath, needs
  the TS7 toolchain). Runs after plain lint in CI. A handful of type-aware rules are off with a
  comment in `.oxlintrc.json`: some for good (documented, permanent) reasons — app-web's
  `only-throw-error` exception for react-router's throw-a-Response idiom — others because turning
  on real type info for the first time surfaced a large pre-existing backlog unrelated to any one
  change (`no-unsafe-assignment`, `prefer-readonly-parameter-types`, and others), left for a
  dedicated follow-up rather than folded into whatever PR happened to flip the switch.
- `bun run format` — `format-codemod` (blank-line padding, explicit source globs — the codemod has
  no ignore file, so the glob list is what keeps it off committed codegen output like `app/gql`),
  then `oxfmt .` (`.oxfmtrc.json` at the root). The formatter runs last and owns the final state: it
  strips the codemod's padding after multiline imports, which its import sorter contradicts.
- `bun run format:check` — `oxfmt --check .` only. The codemod has no check leg here: on an
  oxfmt-final tree it always wants its import padding back, so a check would never be green. Its
  other conventions still land on every `bun run format` and pre-commit run.
- `bun run build` — `turbo run build`; one project via `--filter`.
- `bun run e2e` — `turbo run e2e` (Playwright, `app-web-e2e`).
- `bun run boundaries` — `turbo boundaries`.

## Docker

Each deployable (`app-web`, `db-postgres`, the 6 services) has a multi-stage Dockerfile around
`turbo prune <pkg> --docker`:

1. **pruner** — a standalone `turbo` binary prunes to the target's dependency graph: `out/json`
   (manifests only, for layer caching), `out/full` (source), a pruned `out/bun.lock`.
2. **installer** — full `bun install` against `out/json` for build-time tooling.
3. **builder** — copies `out/full` plus `scripts/build-esbuild.ts` and `tsconfig.base.json` (outside
   any package, so prune doesn't carry them), then runs the project's `build` script.
4. **prod-deps** — `bun install --production --linker=hoisted`. Hoisting is load-bearing: a bundle
   inlines source from several packages, and its external imports (`pino`, …) must resolve from the
   bundle's own location — only a flat `node_modules` serves them all.
5. **runtime** — `node:24.18.0-alpine` with the prod-deps `node_modules` and built output only.

app-web's builder runs its `codegen`/`typegen`/`build` scripts directly instead of
`turbo run build`, which would pull in `//#codegen:graphql` — that task reads service-api's schema,
outside app-web's pruned graph. `app/gql/**` is committed so builds without service-api's source use
it as-is.

## Tooling migration in progress

See #160 for the full phase plan (turborepo + bun, spike-gated; shared configs and AGENTS.md from
`zgeoff/tools`). This repo is mid-migration — several claims in `agents/shared.md` above describe
the _target_ state, not this repo yet:

- **lefthook** — not adopted. Git hooks are still husky + lint-staged (`.husky/`), minimally adapted
  to invoke bun. Lands in #189.
- **`bun test`** — not adopted. bun is the package manager and script runner only; all
  unit/integration tests run under vitest on node. Deferred past #160 to the rebuild (#163) — vitest
  stays until services move to the bun runtime.

oxlint/oxfmt and `@zgeoff/format-codemod` landed in #188 (the codemod installs through a tracked
`minimumReleaseAgeExcludes` entry in `bunfig.toml` — #219 removes it once 0.0.1 ages past the gate).
Type-aware lint (`oxlint --type-aware`/tsgolint) landed in #217 once the TS7 toolchain it needs was
in place — see the Running Things Today section above for what's still off and why.

Don't "fix" these to match the shared partial mid-migration — follow the phase plan in #160 instead.
