# Agent Guidelines

## Required reading

The rules a task needs are not repeated here. Load the skill for the work before starting it, and
read the architecture doc for the subsystem in full before reasoning from its code.

| Skill                | Load before                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `code-style`         | writing, reviewing, or renaming any TypeScript — the shared function-verb taxonomy                        |
| `project-code-style` | the same, beside `code-style` — vers's own code rules and lint directives                                 |
| `testing`            | designing, writing, or reviewing tests — with `project-testing`                                           |
| `docs-writing`       | writing or editing any committed prose: `docs/`, READMEs, this file, skills — with `project-docs-writing` |
| `game-lifecycle`     | any work in the activity, replay, or idle packages — the assumptions to drop and the state machines       |

`docs/architecture/overview.md` is the entry point to the system's docs. A subsystem's doc is the
authoritative account of its invariants: grep locates code, and it does not teach a subsystem's
rules. Read the doc for the area in full before substantial work there:

- Activities, the seed chain, verification, replay or reconcile:
  `docs/architecture/game/game-simulation.md`, `docs/architecture/game/replay-verification.md`,
  `docs/architecture/game/seed-chain.md`, `docs/architecture/game/offline-reconcile.md` and
  `docs/architecture/game/glossary.md`.
- World-map generation, reveal or fog of war: `docs/architecture/game/worldmap.md`.
- Item and reward rolls, or content entropy: `docs/architecture/game/item-generation.md` and
  `docs/architecture/game/game-entropy.md`.
- Error handling, metrics, analytics, deploys and the database: the doc that each section below
  points to.

## Repo structure

vers is one Bun workspace. Every package takes the name `@vers/` plus its leaf folder name. A
library or contract is consumed as TypeScript source through an `exports` map that points at
`src/index.ts`, with no build step. Two names differ: `services/<name>` is `@vers/service-<name>`,
and `contracts/<name>` is `@vers/contract-<name>`.

```text
apps/              deployables: web, web-e2e (Playwright), umami, bugsink
services/          domain services; each compiles to a Bun binary on alpine
contracts/         one oRPC contract per service, plus contract-base
libs/<domain>/     shared libraries, grouped by domain for browsing only: core, data, design,
                   game, service, testing
infra/             the vers-infra Pulumi program (GitHub labels and settings, Neon, Axiom) and the
                   Tinybird datasources
scripts/           @vers/scripts: the operational CLIs behind bun run deploy, stack and pg:*
templates/service/ the scaffold for a new service
patches/           bun patches for third-party packages
docs/
  architecture/    what is built, by area: game, platform, services
  game-design/     what a player sees, feels and decides
  runbooks/        operator and contributor procedures
deploy.config.ts   the manifest every Fly rollout reads
```

## Packages

Dependencies:

- Every external version lives once, in the root `workspaces.catalog`. A package writes `"catalog:"`
  for an external dependency and `"workspace:*"` for an internal one.
- Pin exact versions, with no `^` or `~` ranges. `bun add` saves exact versions, so the rule covers
  hand-written edits.
- A root override, an age-gate exclude in `bunfig.toml`, or an audit ignore stays only while it
  changes the install. `bun run deps:check` runs in the PR checks and the weekly dependency-health
  job. It fails on an exclude past the removal date in its comment, an override that every range in
  `bun.lock` admits, and an audit ignore whose advisory is gone or has a fix in range. One
  exception: an override that pins the catalog version keeps every copy on that version, so the
  check keeps it.
- TypeScript is version 7, with no `baseUrl` and no path aliases, so write each import relative to
  the importing file.

Boundaries:

- `bun run boundaries` checks each import against the tags in each project's `turbo.json` and the
  rules in the root `turbo.json`. It also flags an import of a package missing from the importer's
  `package.json`.
- A `lib` imports no `service` or `app`, and a `service` imports no `app`, transitively.
- A project tagged `server-only` is importable only by a `service` or another `server-only` project,
  and the check follows dependents transitively. So no package that the root manifest or an app
  depends on may import one.
- `bun run boundaries` reads the filesystem and ignores `.gitignore`, so run it on a clean tree:
  stale `dist/` or `styled-system/` output reads as source.

Repo scripts:

- `scripts/src/bin/` holds the entrypoints: thin shells that sequence I/O and exit codes. Root
  `package.json` scripts run them with plain `bun`.
- `scripts/src/<domain>/` holds the logic, and `scripts/src/utils/` takes only domain-free pieces.
  Decision logic is pure, data in and findings out, with tests beside it.
- A tool that imports a `server-only` package lives in its own `server-only` package with its own
  `src/bin/`, such as `libs/testing/qa-account`. The root manifest and the e2e app depend on
  `@vers/scripts`, and the boundaries check follows that edge.

## Commands

- `bun run typecheck`, `bun run test`, `bun run build` and `bun run e2e` run through turbo. Pass
  `--filter=@vers/<name>` for one project.
- Every JS and TS package runs on `bun test`; never add vitest. Start
  `bun run pg:test-container:start` before a postgres-backed suite.
- CI fails a run when any test takes longer than 5 s, whatever timeout the test sets. On CI each
  package's `bun test` writes a JUnit report, and `bun run test:check-slow` reads every report and
  lists the slowest tests.
- `bun test` reads `bunfig.toml` from the working directory and never merges it up. A root-invoked
  `bun test <file>` still resolves the jest-extended matchers from the root preload.
- `bun run lint` runs codegen and typegen first, then the type-aware oxlint pass over the whole
  tree. Without the generated output, those imports degrade to `any` and the unsafe rules report
  hundreds of false violations.
- Run `bun run format` from the repo root. The codemod reads its exclusions from the working
  directory.
- `bun run deadcode` runs knip, which also needs the codegen output. A dependency knip cannot see
  gets a `knip.json` ignore in the PR that adds it.
- lefthook runs the light checks before a commit and a push, and CI runs the rest.
- `apps/bugsink` is Python. Its `test:adapter` script runs `pytest` under `uv`, outside the Bun
  graph.
- The `bun run qa:*` scripts drive manual QA: a QA account, the verification inbox, a debug Chrome,
  and a cold fleet. `docs/runbooks/qa.md` covers them.

## Error handling

Read `docs/architecture/services/error-handling.md` before you add or change a failure path. It owns
the taxonomy, the status rules, trace context and the reporting split.

- A procedure handler throws only its typed `opts.errors.*` constructors or `invariant()`. A handler
  has no try/catch for logging or reporting, because the central `onError` interceptor in
  `createService` owns that.
- Every contract `.errors({…})` map is built with `defineErrors` from `@vers/contract-base`. A code
  outside oRPC's canonical set declares an explicit `status`, and its `defineErrors` entry is its
  registry. Name such a code `NOUN_PROBLEM`.
- A client narrows on `code` through `isDefinedError` or `safe` and acts on `data` fields, never on
  `message` strings.
- The Sentry SDK is the only path to the error backend, and pino is a log sink only. Never wire a
  log transport to the error backend. Never call `captureException` in code that the central hooks
  already cover: the service interceptor, the query caches and the root error boundary.
- In app-web, form validation returns `submission.reply()`, navigation and access control throw
  `redirect()` or a `Response`, and a fault throws and lands on a route `errorComponent`. Retry
  policy is central in `buildQueryClient`. A per-query `retry` override needs a reason the default
  policy cannot express.

## Metrics

Work that adds a pipeline, queue, worker or failure path lands with the OpenTelemetry metrics that
make it observable. Read `docs/architecture/platform/observability.md` before you add an instrument.

- Define an instrument in its owning package through the global metrics API (`metrics.getMeter` from
  `@opentelemetry/api`). Domain code never constructs, receives or stops a meter provider, because
  the service scaffold owns that lifecycle.
- Name a metric `vers.<domain>.<measure>`. Attributes are snake_case with closed value sets, never
  unbounded values such as per-entity IDs.
- Record a rare, meaningful event as a counter at the site that decides it, in a `record-*.ts`
  module. State that lives in the database reports through observable gauges: one batch callback per
  package and one snapshot query per collection, with failures caught and logged, never thrown.
- An instrument's `description` and `unit` in its definition are its registry, so a new instrument
  needs no doc row.

## Analytics

Read `docs/architecture/analytics.md` before you add or reshape an analytics event. It owns both
streams, the event registry and the privacy stance.

- **Umami web analytics:** a player-facing flow whose completion is an acquisition-funnel step fires
  a curated event through `sendAnalyticsEvent`. These events carry no personal data and no user or
  avatar keys.
- **Tinybird product events:** a game flow whose outcome feeds funnels, retention or progression
  analysis fires a curated event through `emitProductEvent`.
- Name a product event in snake_case `noun_pastparticiple`, such as `activity_started`. Its
  properties are the IDs of the entities it is about. The server stamps identity from the caller's
  session, so a client payload never carries user or session keys.
- A new product event lands in one PR with its entry in the `@vers/product-analytics` registry
  types, its arm in app-web's ingest schema, any new column in
  `infra/tinybird/datasources/product_events.datasource`, and its row in the registry table in
  `docs/architecture/analytics.md`.
- Never await `emitProductEvent`, and never gate a flow on it. Fire it only for something that has
  already happened, such as a service response, a worker broadcast or a completed client transition,
  never for an intent.

## Env files

A service's env contract is the `envShape` it passes to `createService`, merged with the shared
`baseEnvSchema` and validated against `process.env` at boot.

- A project that needs a local `.env` commits a `.env.example` with its keys. `bun run env:pull`
  pulls the real values from 1Password. Never commit a `.env` file.
- Each service commits its key lists as `env-contract.generated.json`. Regenerate it with
  `bun run env:contract`, because CI fails on a stale one, and on a required key missing from the
  service's dev env files, the compose stacks, or the app's Fly env and secrets.

## Deploys

`bun run deploy` drives every Fly rollout from `deploy.config.ts`, and `deploy verify` checks that
the fleet is online and current. Read `docs/architecture/platform/deployment.md` before you change a
rollout, a container build or a secret.

- Database migrations run once per green push, in their own `migrate` job that is never cancelled,
  never per service.
- Deploy jobs target the `production` GitHub environment. Repo-level secrets hold only what PR
  checks need.

## Postgres access (MCP)

The `postgres` MCP server exposes a production source and a dev source. Read
`docs/architecture/platform/database.md` before you connect to or provision the database.

- `execute_sql_prod` and `search_objects_prod` query production read-only. The tool and the role
  both refuse writes.
- `execute_sql_dev` and `search_objects_dev` reach a throwaway database cloned for the current
  worktree on first use: migrated, seeded, and open to reads and writes.
- Tests never point at the dev database. Postgres-backed suites own the local test container.
- After you remove a worktree, `bun run pg:dev:sweep` drops its database.
  `bun run pg:dev:refresh-base` rebuilds the clone template when the seed data changes.
