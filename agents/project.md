## Function naming: project verbs

Project-level additions to the shared function-naming taxonomy, under the same rules.

**Pure producers** — result comes from arguments alone, no side effects:

| Prefix    | Contract                                                                  | Example                |
| --------- | ------------------------------------------------------------------------- | ---------------------- |
| `compare` | aligned structures in, equivalence verdict out                            | `compareReplaySegment` |
| `fold`    | a baseline value plus a list of items reduced into one accumulated result | `foldOptimisticBuild`  |

**Effectful** — touches the world (filesystem, streams, processes, registries):

| Prefix      | Contract                                                                                    | Example                  |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| `advance`   | step a stateful cursor, clock, or simulation forward in place, optionally to a target       | `advanceToDuration`      |
| `broadcast` | post one message to every connected client on whichever transport carries it                | `broadcast`              |
| `dispose`   | release the resources a built entry holds (a GPU buffer, texture, or subscription)          | `disposeBiomeChunkEntry` |
| `flush`     | attempt delivery of the durable outbound backlog, removing entries confirmed received       | `flush`                  |
| `ingest`    | submit a locally held record into an external system, settling its local copy by the answer | `ingestStartRow`         |
| `mint`      | create and persist a new identity-bearing row rooted in a chain or coordinate               | `mintContinuation`       |
| `park`      | set a work item aside in a parked status for later resumption                               | `parkActivity`           |
| `record`    | durably note that an event occurred (counter, log, audit row)                               | `recordFailedAttempt`    |
| `redirect`  | return a redirect response for a request failing a gate, else defer                         | `redirectToHTTPS`        |
| `refresh`   | rebuild a derived resource in place from its current source, discarding prior contents      | `refreshDevBase`         |
| `reject`    | mark a work item refused and apply the consequences                                         | `rejectActivity`         |
| `report`    | forward a fault to the error backend                                                        | `reportUnexpectedError`  |
| `restart`   | return a long-running resource to service from its initial state                            | `restartActivity`        |
| `roll`      | consume typed draws from a roll stream to produce an outcome, advancing its cursor          | `rollItemFromStream`     |
| `schedule`  | enqueue an event or callback for deferred execution                                         | `scheduleEvent`          |
| `select`    | persist the caller's choice among owned alternatives as the new state                       | `selectAvatar`           |
| `serve`     | answer a request for a static resource, else defer                                          | `serveClientAssets`      |
| `submit`    | accept a payload into a durable outbound queue and schedule its delivery                    | `submit`                 |
| `sweep`     | bulk-remove stale or orphaned resources found by a scan, returning the set removed          | `sweepDevDBs`            |
| `sync`      | reconcile cached state to an external source, clearing it the first time the source changes | `syncSeed`               |
| `upgrade`   | hand a structural port to an RPC handler so it starts serving calls over it                 | `upgrade`                |

## Comments

Two comment jobs, two locations. A JSDoc block on a declaration carries the caller-facing contract:
what a reader needs to use the thing without opening its body — the guarantee, the invariants a
caller must uphold, the failure modes. A `//` at a statement carries the implementation note: why
that line does the non-obvious thing. A body's mechanism — how the algorithm walks, which step does
what — is never narrated from the top; it lives at the lines, or nowhere when the code already shows
it.

- Prefer the enforceable form. Before writing a comment, put the fact where a machine holds it:
  encode an outcome set as a discriminated union, a bound as a named constant, a caller rule as a
  type; protect a frozen wire or draw layout with a golden test. Comment only the residue neither a
  type nor a test can hold, and where a test enforces an invariant, point at it rather than
  restating the consequence.
- Comment the decision, not the code. A comment states an invariant, cross-file or runtime behavior,
  or why a non-obvious choice was made. One that restates the name, the signature, or the next
  line's mechanics is a defect — delete it.
- A long JSDoc block is a placement smell, not a prose exercise. When a declaration's comment runs
  long because it narrates the body, relocate: the mechanism to `//` at the lines, the enforceable
  parts into types or tests, leaving the block at the contract. A genuinely irreducible multi-point
  contract stays — render it as structured prose (one point per paragraph, led by its topic
  sentence; one fact per sentence; an outcome map or state-to-action table as a bullet list) and
  load the `docs-writing` skill for its wording.
- JSDoc blocks are always multi-line (`/**` alone, one `*`-prefixed line per point, `*/` alone —
  never single-line `/** … */`), attached directly to the declaration they describe.
- Comments describe the code as it is now — no history ("previously", "now uses"), no project state
  (issue numbers, phase labels, "not wired yet"); those live in the commit message.
- Comments don't name other declarations — renames strand the reference. State the contract instead:
  "callers must pass edits sorted last-to-first", not "(buildEditsFromAST's contract)". A
  declaration's own parameters and signature types are fine to name.

## Golden values in tests

- A golden value — transcribed machine output no human derives by reading the code: a stream's draw
  sequence, a rolled encounter or item, a derived key, an RNG state — is asserted with
  `toMatchInlineSnapshot()`. `bun test -u` regenerates it after an intentional behavior change, and
  the regenerated diff is reviewed like any code change.
- Human-authored expectations keep explicit matchers: spec test vectors from an external authority,
  wire forms readable against their encoding, and property assertions. A snapshot there would bless
  a broken implementation's own output.

## Review bots

CodeRabbit and cubic review every PR, configured by `.coderabbit.yaml` and `cubic.yaml` at the repo
root; CodeRabbit reads this file as its guidelines.

- A PR is ready only after both bot reviews are read and every finding is answered on its own
  thread: a fixed finding's reply cites the commit that fixed it; a declined finding's reply states
  the reason — when a finding contradicts this file, this file wins and the reply names the rule.
  Reviews land within a few minutes of opening; read them with `gh pr view <n> --comments` and
  `gh api repos/zgeoff/vers/pulls/<n>/comments`.
- Resolve a thread once its reply is posted, fixed and declined alike (GraphQL
  `resolveReviewThread`). A finding the agent cannot confidently judge is escalation, not
  disposition: reply saying so and leave the thread open for a human.
- Never teach a bot through chat (`@coderabbitai` learnings and the like) — a correction to bot
  behaviour is an edit to `.coderabbit.yaml` or `cubic.yaml`, reviewed in a PR.
- Bots review a PR once, at open; an agent invokes a re-review only when asked, never on its own
  initiative.

## Issue hygiene

Triage a GitHub issue the moment it's opened, not in a later pass:

- assign the delivery-phase milestone and the area, type, and priority labels
- record blocking edges against the issues it depends on
- add it to the delivery board and set its board status

An open issue that isn't on the board with a milestone and status is a defect.

The label registry is the vers-infra Pulumi program (`infra/github.ts`): a label change is a PR
there, never a console edit. Milestones stay console-managed — they are delivery state, not schema.

A new issue's body follows its type's template in `.github/ISSUE_TEMPLATE` (feature, bug, upkeep). A
feature issue whose outcome a player can perceive — every `area/game` feature — carries a
`## Player story` section: second person, present tense, what the player concretely sees or feels
once it ships, including what they don't experience (no dupes, no lost progress), closing with a
one-sentence distillation. The story names no implementation nouns — no table, field, component, or
service names; machinery belongs in Scope. The issue-hygiene workflow checks each new issue's
labels, milestone, and required sections (dep-health's generated report issues excepted) and
comments the defects it finds. After opening or editing an issue, run
`bun scripts/src/bin/issue-hygiene.ts <n>` and clear every finding before handing it back — it runs
the workflow's own check locally, so a dropped template section is caught before CI.

Upkeep issues are the exception: event- or date-triggered maintenance (dropping a dependency
override, deleting an audit ignore) carries the `upkeep` label plus an area label, no milestone, and
stays off the delivery board. The issue body opens with a fenced trigger line —
`trigger: release <pkg> ><version>` or `trigger: date <YYYY-MM-DD>` — that the weekly dep-health
sweep evaluates, commenting and marking the issue `upkeep-ready` when the condition holds. An upkeep
issue without a parseable trigger line fails the sweep.

## Type-only modules

A module whose exports are all types or interfaces is a defect: those exports belong in the
directory's `types.ts`, one per directory, holding every type its files share.

## Invariants

Express a true invariant — a condition only a bug can break — with `tiny-invariant`
(`invariant(value, 'message')`) rather than a hand-rolled `if`/`throw`. A condition real input can
trigger is ordinary control flow, not an invariant.

## Untyped column boundaries

An untyped jsonb or text column value re-enters typed code through its contract schema's `.parse` —
a malformed row fails loudly at the read — or by threading the typed value its author already holds;
never through a bare `as` cast. A write TypeScript cannot prove assignable to the column's `Json`
type goes through the one documented converter (`toJSON`, `@vers/db`).

## Third-party packages

Prefer an established, narrowly scoped third-party package over hand-rolling the same logic —
recommend one whenever it covers the need. Hand-roll only when no candidate is both proven and
focused on the problem, when a Bun or Node builtin already covers it, or when the logic is small
enough that a dependency costs more than it saves.

## Architecture docs

The system is documented under `docs/architecture/`, with `docs/architecture/overview.md` as its
narrative entry point. A subsystem's doc is the authoritative account of its invariants — grep
locates code, it does not teach a subsystem's rules.

- Before substantial work in a subsystem, read its doc in full first, not after reasoning from code
  fragments. Mandatory reads by area:
  - activities, the seed chain, verification, replay, or reconcile —
    `docs/architecture/game/game-simulation.md` and `docs/architecture/game/seed-chain.md`
  - world-map generation, reveal, or fog of war — `docs/architecture/game/worldmap.md`
  - item and reward rolls, or content entropy — `docs/architecture/game/item-generation.md` and
    `docs/architecture/game/game-entropy.md`

  The error-handling, metrics, analytics, deployment, and database sections carry their own
  mandatory read.

- A behavior change to a documented subsystem updates that subsystem's doc in the same PR. The doc
  states current behavior, so a change that leaves it stale is incomplete.

## Error handling

Read `docs/architecture/services/error-handling.md` before adding or changing a failure path — it
owns the full taxonomy, code registry, trace context, and reporting split. The rules a PR must
satisfy:

- A procedure handler throws only its typed `opts.errors.*` constructors or `invariant()`. No
  try/catch for logging or reporting in handlers — the central `onError` interceptor in
  `createService` owns that.
- Every contract `.errors({…})` map is built with `defineErrors` (`@vers/contract-base`). A bespoke
  code (any code outside oRPC's canonical set) declares an explicit `status` and lands with its row
  in the `docs/architecture/services/error-handling.md` registry table in the same PR; bespoke codes
  are named `NOUN_PROBLEM`.
- Clients narrow on `code` via `isDefinedError`/`safe` and act on `data` fields — never on `message`
  strings.
- The Sentry SDK is the only path to the error backend; pino is a log-only sink. Never wire a log
  transport to the error backend, and never `captureException` in code the central hooks (service
  interceptor, query caches, root error boundary) already cover.
- app-web: form validation returns `submission.reply()`, navigation and access control throw
  `redirect()`/`Response`, faults throw and land on a route `errorComponent`. Retry policy is
  central in `buildQueryClient`; a per-query `retry` override needs a behavioural reason the default
  policy can't express.

## Metrics

Instrumentation is part of a feature, not a follow-up: work that adds a pipeline, queue, worker, or
failure path lands with the OpenTelemetry metrics that make it observable. Read
`docs/architecture/platform/observability.md` before adding an instrument — it owns the mechanics,
conventions, and instrument registry. The rules a PR must satisfy:

- Instruments are defined in the owning package through the global metrics API (`metrics.getMeter`,
  `@opentelemetry/api`) — domain code never constructs, receives, or stops a meter provider; the
  service scaffold owns that lifecycle.
- Names are dot-namespaced `vers.<domain>.<measure>`; attributes are snake_case with closed value
  sets, never unbounded values like per-entity IDs.
- A rare, meaningful event is a counter recorded at the site that decides it (a `record-*.ts`
  module). State that lives in the database observes through observable gauges — one batch callback
  per package, one snapshot query per collection, failures caught and logged, never thrown.
- Every new instrument lands with its row in the `docs/architecture/platform/observability.md`
  registry table in the same PR.

## Banned words

Overused jargon a plainer word covers; applies to all prose — docs, comments, PR descriptions, issue
text.

- `bites` (figurative) — "applies", "takes effect", or name the consequence.
- `CAS` (the acronym) — "compare-and-swap" spelled out, or name the behaviour: a guarded update that
  applies only if the cursor still holds its expected value.
- `ceiling` (figurative limit) — "cap", "limit", "maximum", "upper bound"; a timeout is a "timeout".
  A game mechanic the design names a ceiling keeps the name.
- `fence` / `fencing` (the distributed-systems metaphor) — state the rule it enforces: "each
  activity has a single writer", "an append from any other session is rejected". A markdown code
  fence is a different word and stays.
- `floor` (figurative minimum) — "minimum", "lower bound", "at least". A literal floor and a game
  mechanic the design names a floor keep the name.
- `load-bearing` — "required", "essential", or name what breaks without it.
- `seam` — "boundary", "join", "integration point".
- `surface` — noun: "area", "API", the concrete thing itself; verb: "show", "raise", "report".

## Monorepo layout

Packages live under kind-first roots; `docs/architecture/overview.md` lists every project.

- Workspace globs: `apps/*`, `services/*`, `contracts/*`, `libs/*/*` (grouped by domain: `core`,
  `data`, `design`, `game`, `service`, `testing`), `infra`, and `scripts`.
- Internal deps use the `workspace:*` protocol; every external version lives in the root manifest's
  `workspaces.catalog`, referenced everywhere as `catalog:` — project manifests carry no version
  pins.
- Libraries are consumed as TypeScript source (`exports` → `./src/index.ts`); there are no
  per-library build steps.
- `bun install` uses the isolated linker with exact pins and a 7-day `minimumReleaseAge`
  (`bunfig.toml`).
- Turborepo drives the task graph from the root `turbo.json`; per-project `turbo.json` files exist
  only to declare `boundaries` tags. CI's changed-project detection is `turbo run --affected`.
- TypeScript is 7.0.2: no `baseUrl`, no path aliases — write imports relative to the importing file.
  Node is 24.18.0 in CI and app-web; the domain services compile to a Bun binary on `alpine`.

## Boundaries

Projects are tagged `lib`, `service`, or `app` in their own `turbo.json`; the root `boundaries`
block denies `lib` → `service`/`app` and `service` → `app` imports, transitively.
`bun run boundaries` also flags imports of packages missing from the importer's `package.json`. It
walks the filesystem ignoring `.gitignore` — run it on a clean tree, or stale
`dist/`/`styled-system/` output reads as source.

Package naming is `@vers/` plus the leaf folder name (`libs/core/utils` → `@vers/utils`, `apps/web`
→ `@vers/web`), except `services/user` → `@vers/service-user` and `contracts/user` →
`@vers/contract-user`. The `libs/<domain>/` grouping is browsing-only — moving a lib between domains
changes nothing but its path.

## Repo scripts

Operational tooling is the `@vers/scripts` workspace package (`scripts/`), covered by typecheck,
test, lint, boundaries, and knip like any project.

- `src/bin/` holds the executable entrypoints — thin shells that sequence I/O and exit codes.
- `src/<domain>/` directories (`deploy/`, `stack/`, `postgres/`) hold the composable logic;
  `src/utils/` accepts only domain-free pieces.
- Decision logic is pure — data in, findings out — with co-located tests; effect modules stay thin
  enough that running the CLI is their coverage.
- Root-manifest entries (`bun run deploy`, `bun run stack`, `pg:*`) invoke the bin files with plain
  `bun`.

## Env files

A service's env contract is the `envShape` it passes to `createService`, merged with the shared
`baseEnvSchema` and validated against `process.env` at boot. A project that also needs a local
`.env` ships a committed `.env.example` documenting its keys; real values come from
`bun run env:pull`, which pulls each managed file from 1Password via the `op` CLI. `.env` files
themselves are never committed. Each service commits its derived key lists as
`env-contract.generated.json`, regenerated by `bun run env:contract`; CI fails on a stale artifact,
on a required key missing from the service's dev env files or either compose stack, and — before any
image builds — on one missing from the app's Fly env and secrets
(`docs/architecture/platform/deployment.md`).

## Deploys

`bun run deploy` drives every Fly rollout from the `deploy.config.ts` manifest at the repo root;
`deploy verify` asserts the fleet is online and current. Read
`docs/architecture/platform/deployment.md` before changing a rollout, container build, or secret —
it owns the mechanics, staleness detection, and CI wiring.

- Database migrations run once per green push in their own never-cancelled `migrate` job — never per
  service.
- Deploy-phase jobs target the `production` GitHub environment; repo-level secrets carry only what
  PR checks need.

## Analytics

app-web ships self-hosted Umami web analytics (`apps/umami`). A player-facing flow whose completion
is an acquisition-funnel step fires a curated event through `sendAnalyticsEvent`
(`apps/web/src/lib/send-analytics-event.ts`) — weigh this when building or reshaping such flows.
Analytics events carry no PII and no user or avatar keys — data that would be joined to a user
belongs in the product-analytics stream instead. Boundaries and privacy stance:
`docs/architecture/analytics.md`.

Tinybird carries the behavioural product-event stream. A game flow whose outcome feeds funnels,
retention, or progression analysis fires a curated event through `emitProductEvent`
(`apps/web/src/lib/product-events/emit-product-event.ts`) — weigh this when building or reshaping
game flows. Read `docs/architecture/analytics.md` before adding or reshaping an analytics event — it
owns the mechanics and the event registry. The rules a PR must satisfy:

- Event names are snake_case `noun_pastparticiple` (`activity_started`); properties are ids of the
  entities the event is about. Identity is stamped server-side from the caller's session — a client
  payload never carries user or session keys.
- A new event lands with its entry in the `@vers/product-analytics` registry types, its arm in
  app-web's ingest schema, any new column in `infra/tinybird/datasources/product_events.datasource`,
  and its row in the `docs/architecture/analytics.md` registry table — all in the same PR.
- Emission is fire-and-forget through `emitProductEvent`: never await it, never gate a flow on it,
  and fire only for something that has already happened — a service response, a worker broadcast, a
  completed client transition — never for intent.

## Postgres access (MCP)

The `postgres` MCP server exposes production and dev sources. Read
`docs/architecture/platform/database.md` before connecting to or provisioning the database — it owns
the mechanics and provisioning.

- `execute_sql_prod` / `search_objects_prod` query production read-only — writes are refused at both
  the tool and role layer.
- `execute_sql_dev` / `search_objects_dev` hit a disposable database cloned for the current worktree
  on its first use: no setup step, full read/write, migrated and seeded. Sessions that never query
  postgres never touch the database.
- Tests never point at the dev database — postgres-backed suites own the local test container.
- After removing a worktree, `bun run pg:dev:sweep` drops its database;
  `bun run pg:dev:refresh-base` rebuilds the clone template when seed data changes.

## Styling

Panda CSS 2.0 spans `@vers/panda-preset`, `@vers/styled-system`, `@vers/design-system`, and app-web,
pinned at 2.0.0-beta.8 in the catalog — no stable 2.0 release exists.

- `@vers/panda-preset` composes `presets: [presetBase, presetPanda]` — Panda 2.0 ships no bundled
  default preset.
- CSS values that aren't theme tokens need the bracket escape hatch (`cursor: '[pointer]'`,
  `borderWidth: '[1px]'`) — 2.0's `SystemStyleObject` value types reject arbitrary strings and
  numbers.

### Screens

Screens and routes are built workable-only:

- Compose existing `@vers/design-system` components and semantic tokens (`bg.*`, `text.*`,
  `border.*`, `accent.*`) — no bespoke visual styling beyond layout, no one-off
  colors/fonts/animations, no polish passes.
- The semantic-token layer is the stable contract: re-skins change token values, never token names,
  so screens that stick to it adapt for free.
- A screen needing a component that doesn't exist yet builds the minimal version in its own PR and
  promotes it into `@vers/design-system` when a second consumer appears.

## Client state (Zustand)

Zustand holds client state; server cache lives in TanStack Query.

- Each package composes its client state into one bound store, built by spreading state-only slice
  factories (`create-<concern>-slice.ts`, each returning its fields' initial values) inside a single
  `create<Store>()(() => ({ … }))`. A package with a second genuinely disjoint domain (game-
  rendering's satellite registry beside its scene state) may hold a second store.
- Stores hold state only — no colocated actions. Mutation goes through external setter modules
  (`set-*.ts`, `toggle-*.ts`) calling `setState`, so writers work outside React (workers, engine
  callbacks). One `setState` per logical event: an event that changes several fields gets one
  consolidated writer, never a per-field fan-out.
- `index.ts` exports selector hooks and setters, never raw store handles. A package-external
  imperative read goes through an exported `get*` reader.
- `useShallow` wraps only selectors that build a fresh object or array; a selector returning a
  primitive or a single stored reference goes bare.
- Middleware wraps only the combined store, never an individual slice.
- Inside the R3F frame loop, reads are imperative `getState()` calls
  (`docs/architecture/game/game-rendering.md`); DOM components subscribe through selector hooks.

## Running things

- `bun install` — whole workspace (`--frozen-lockfile` in CI; `bun.lock` is committed).
- `bun run typecheck` — `turbo run typecheck`; one project via `--filter=@vers/<name>`.
- `bun run test` — `turbo run test`, each project's own runner; one project via `--filter`. Every
  JS/TS package runs on `bun test` — never add vitest. Postgres-backed suites need
  `bun run pg:test-container:start` first. bunfig is read from cwd, not merged up, but root-invoked
  `bun test <file>` still resolves jest-extended matchers from the root preload.
- `bun run lint` / `bun run lint:fix` — `turbo run codegen typegen`, then type-aware oxlint over the
  whole tree. The codegen leg is required: without generated output (panda's `styled-system`, router
  typegen) those imports degrade to `any` and the unsafe-\* rules report hundreds of false
  violations.
- `bun run format` — `oxfmt .`, then `format-codemod` (blank-line padding). Run from the repo root:
  the codemod's exclusions (`.formatignore`, keeping it off committed codegen output and nested
  checkouts) are read from the working directory. The chain is idempotent.
- `bun run format:check` — both tools' check legs.
- `bun run build` / `bun run e2e` / `bun run boundaries` — `turbo run` each; `e2e` is Playwright
  (`@vers/web-e2e`).
- `bun run deadcode` — knip (`knip.json`); blocking in CI and pre-push. Needs codegen output
  present; a dependency knip can't see gets a `knip.json` ignore in the PR that introduces it.
- Git hooks: lefthook (`lefthook.yml`, installed by `prepare`). Pre-push tests changed files only
  (`turbo run test --affected`); `LEFTHOOK=0` skips all hooks.
- Python (`apps/bugsink` only) runs `pytest` under `uv` via its `test:adapter` script, outside the
  Bun graph; the `python-tests` workflow runs it on change.

## Lint policy

- Every type-aware rule is on (`.oxlintrc.json`; oxlint-tsgolint underneath, ~5s wall with warm
  caches). Two permanent exceptions: `only-throw-error`'s documented app-web override, and the
  inline directives on `@vers/idle-core`/`@vers/worldmap-core` tick/lifecycle handlers that mutate
  their entity parameter by design.
- Pre-existing violations are baselined inline with
  `// oxlint-disable-next-line <rule> -- baseline(#236)`, never turned off in config. The
  unused-directive check is the ratchet: fixing a baselined site strands its comment, and lint fails
  until the comment is deleted.
- `typescript/prefer-readonly-parameter-types` is never baselined: a function's own
  data/config/props/option types go `readonly` (React props `Readonly<Props>`), and framework
  handles with no readonly form (a `Kysely`/`Elysia`/`RPCHandler`/`Request` handle, a `Date`, …) are
  exempted per-type via the rule's `allow` list in `.oxlintrc.json` — never an inline marker. Only a
  genuinely un-`readonly`-able own type (a generic callback-arg object, a `ZodType`-bearing shape)
  carries a single inline directive stating why.

## Testing

Testing conventions — the three regimes by package kind, the mock-free / no-branching / co-location
rules, isolation levels, factories and composites, and the MSW / RSC / Forms / real-database
specifics — live in the `testing` skill. Load it before designing, writing, or reviewing tests.
