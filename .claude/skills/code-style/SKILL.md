---
name: code-style
description:
  Load before writing, reviewing, or renaming any TypeScript in this repo — every function name must
  start with a verb from the taxonomy here, and the lint rule enforcing it reads the same list.
  Covers module layout and file naming, the function-verb taxonomy, comments, invariants, untyped
  column boundaries, third-party packages, Panda CSS styling, and Zustand client state.
---

# Code style

Mechanically enforced rules (oxfmt, oxlint, format-codemod) aren't repeated here — this skill covers
what tooling can't check.

- One primary export per file, and the file name kebab-cases that export (`with-jest-context.ts`
  exports `withJestContext`). Exceptions: `index.ts` entrypoints, `types.ts` for a package's shared
  types, and side-effect-only modules, which are named for what they do (`augment-bun-test.ts`).
- Module order: imports, the primary export, then private helpers in composition order (depth-first)
  — never helpers first. Supporting declarations (consts, interfaces, type aliases) sit directly
  above their first use, never below it and never leading the file; types for the primary export's
  signature may sit just above it.
- Acronyms stay uppercase in identifiers (`runCLI`, `parseCLIArgs`, `ASTNode`, `pkgURL`,
  `isPackageJSON`) — except when one starts a camelCase name, where it lowercases whole (`cliPath`,
  `astNode`). ID counts as an acronym: `userID`, `sessionID` — never `userId` — and `idToken` when
  it starts a name. File names are unaffected: kebab-case lowercases everything (`parse-cli-args.ts`
  exports `parseCLIArgs`).

## Function naming

Every function name starts with a prefix from the closed list below. Pick from it, or extend this
skill and the `verbs` option of the function-verb lint rule in `.oxlintrc.json` in the same PR that
introduces the new verb. The prefix is a contract — a reader should know the function's shape
without opening it.

**Predicates** — return boolean, no side effects:

| Prefix   | Contract                | Example          |
| -------- | ----------------------- | ---------------- |
| `is`     | type or state test      | `isVarDecl`      |
| `has`    | containment, possession | `hasBlankLine`   |
| `can`    | capability              | `canResize`      |
| `should` | policy decision         | `shouldSkipFile` |
| `needs`  | requirement             | `needsBlankLine` |

**Pure producers** — result comes from arguments alone, no side effects:

| Prefix                        | Contract                                                                  | Example                |
| ----------------------------- | ------------------------------------------------------------------------- | ---------------------- |
| `build<Result>[From<Source>]` | default constructor for values; drop `From<Source>` when no single source | `buildEditsFromAST`    |
| `collect`                     | gather from a traversal or scan                                           | `collectChildNodes`    |
| `compare`                     | aligned structures in, equivalence verdict out                            | `compareReplaySegment` |
| `compress`                    | value → its reversible compact encoding                                   | `compressGraph`        |
| `count`                       | how many                                                                  | `countNewlines`        |
| `decode`                      | `encode`'s output → the original structure, malformed input reported      | `decodeState`          |
| `decompress`                  | reverse a `compress` encoding (non-encoded shorthand is `expand`)         | `decompressGraph`      |
| `define<X>`                   | identity; its only job is compile-time constraint of its literal argument | `defineErrors`         |
| `derive`                      | one-way cryptographic derivation from secret material                     | `deriveAvatarKey`      |
| `encode`                      | structure → its defined compact or wire form, reversed by `decode`        | `encodeState`          |
| `expand`                      | compact form → full form                                                  | `expandInputs`         |
| `find`                        | search that can miss — null/undefined on miss                             | `findPrevious`         |
| `fold`                        | a baseline value plus a list of items reduced into one accumulated result | `foldOptimisticBuild`  |
| `format`                      | value → human-readable string                                             | `formatRange`          |
| `get`                         | cheap access that cannot miss (throwing on a broken invariant is fine)    | `getNodeEnd`           |
| `merge`                       | parts → one value                                                         | `mergeWindows`         |
| `normalize`                   | variant forms → the canonical form                                        | `normalizePath`        |
| `parse`                       | unstructured input → structure, invalid input reported                    | `parseSource`          |
| `pick`                        | select among known alternatives                                           | `pickMode`             |
| `plan`                        | compute an action without performing it                                   | `planGapEdit`          |
| `render`                      | structure → output text or markup                                         | `renderHunk`           |
| `resolve`                     | follow indirection to a concrete value                                    | `resolveBinPath`       |
| `sort`                        | reorder                                                                   | `sortEdits`            |
| `split`                       | one value → parts                                                         | `splitLines`           |
| `to<Result>`                  | cheap representation change                                               | `toPosixPath`          |
| `transform`                   | a package's own source→source operation                                   | `transform`            |

**Effectful** — touches the world (filesystem, streams, processes, registries):

| Prefix         | Contract                                                                                                                                | Example                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `admit`        | verify a caller-authored record against server truth and persist it, rejecting on mismatch                                              | `admitActivityStart`     |
| `advance`      | step a stateful cursor, clock, or simulation forward in place, optionally to a target                                                   | `advanceToDuration`      |
| `apply`        | perform previously planned changes                                                                                                      | `applyEdits`             |
| `assert`       | throw when an invariant doesn't hold                                                                                                    | `assertSpan`             |
| `broadcast`    | post one message to every connected client on whichever transport carries it                                                            | `broadcast`              |
| `check`        | evaluate and report findings; effects allowed per mode                                                                                  | `checkFile`              |
| `claim`        | atomically take exclusive ownership of a work item or resource; ownership ends at commit or an explicit release                         | `claimNextChain`         |
| `create`       | bring a resource into existence (file, directory, process)                                                                              | `createWorkDir`          |
| `dispose`      | release the resources a built entry holds (a GPU buffer, texture, or subscription)                                                      | `disposeBiomeChunkEntry` |
| `drain`        | consume a pending backlog until empty                                                                                                   | `drainJobs`              |
| `emit`         | dispatch an event or notification                                                                                                       | `emitProgress`           |
| `flush`        | attempt delivery of the durable outbound backlog, removing entries confirmed received                                                   | `flush`                  |
| `ingest`       | submit a locally held record into an external system, settling its local copy by the answer                                             | `ingestStartRow`         |
| `load`         | read **and** parse into a ready structure                                                                                               | `loadConfig`             |
| `mint`         | create and persist a new identity-bearing row rooted in a chain or coordinate                                                           | `mintContinuation`       |
| `park`         | set a work item aside in a parked status for later resumption                                                                           | `parkActivity`           |
| `print`        | write to stdout/stderr                                                                                                                  | `printHelp`              |
| `read`         | pull raw content from filesystem or network into memory                                                                                 | `readSource`             |
| `record`       | durably note that an event occurred (counter, log, audit row)                                                                           | `recordFailedAttempt`    |
| `redirect`     | return a redirect response for a request failing a gate, else defer                                                                     | `redirectToHTTPS`        |
| `refresh`      | rebuild a derived resource in place from its current source, discarding prior contents                                                  | `refreshDevBase`         |
| `register`     | add to a registry the caller doesn't own                                                                                                | `registerMatcher`        |
| `reject`       | mark a work item refused and apply the consequences                                                                                     | `rejectActivity`         |
| `remove`       | delete a resource                                                                                                                       | `removeStaleDist`        |
| `report`       | forward a fault to the error backend                                                                                                    | `reportUnexpectedError`  |
| `require`      | throw unless a runtime condition holds — a guard real input can trip (`assert` covers invariants)                                       | `requireAuth`            |
| `reset`        | return state to its initial value                                                                                                       | `resetCombatState`       |
| `restart`      | return a long-running resource to service from its initial state                                                                        | `restartActivity`        |
| `roll`         | consume typed draws from a roll stream to produce an outcome, advancing its cursor                                                      | `rollItemFromStream`     |
| `run`          | execute a subprocess, task, or whole pipeline                                                                                           | `runCLI`                 |
| `schedule`     | enqueue an event or callback for deferred execution                                                                                     | `scheduleEvent`          |
| `select`       | persist the caller's choice among owned alternatives as the new state                                                                   | `selectAvatar`           |
| `send`         | transmit a payload to a remote receiver (fire-and-forget or RPC — no resource semantics; REST mutations are `create`/`update`/`remove`) | `sendWebhook`            |
| `serve`        | answer a request for a static resource, else defer                                                                                      | `serveClientAssets`      |
| `set`          | assign a store's named state slice wholesale — the store-setter idiom; partial mutation is `update`                                     | `setSelectedNode`        |
| `setup`        | prepare the environment or fixture the following code assumes; `teardown` reverses it                                                   | `setupTest`              |
| `start`        | put a long-running resource into service (server, worker, poll loop); `stop` reverses it                                                | `startQueues`            |
| `stop`         | take a long-running resource out of service, releasing what `start` acquired                                                            | `stopWorker`             |
| `submit`       | accept a payload into a durable outbound queue and schedule its delivery                                                                | `submit`                 |
| `subscribe`    | attach a listener to an event source, returning or enabling detachment                                                                  | `subscribeToTicks`       |
| `sweep`        | bulk-remove stale or orphaned resources found by a scan, returning the set removed                                                      | `sweepDevDBs`            |
| `sync`         | reconcile cached state to an external source, clearing it the first time the source changes                                             | `syncSeed`               |
| `teardown`     | release what `setup` prepared                                                                                                           | `teardownTest`           |
| `toggle<Flag>` | invert a boolean state slice                                                                                                            | `toggleDevCamera`        |
| `try<X>`       | X with failures captured as a value instead of a throw                                                                                  | `tryCheckFile`           |
| `unsubscribe`  | detach what `subscribe` attached                                                                                                        | `unsubscribe`            |
| `update`       | mutate existing state or resource in place                                                                                              | `updateIndex`            |
| `upgrade`      | hand a structural port to an RPC handler so it starts serving calls over it                                                             | `upgrade`                |
| `upsert`       | single-statement insert-or-update keyed by a natural or composite key, refreshing the conflicting row's columns in place                | `upsertUser`             |
| `verify`       | test a claim or credential against evidence, rejecting on mismatch                                                                      | `verifySession`          |
| `wait`         | block until an event or condition resolves; may return the awaited value                                                                | `waitForMessage`         |
| `write`        | persist to the filesystem                                                                                                               | `writeOutput`            |

**Wrappers and factories** — the result is behaviour, not data:

| Prefix    | Contract                                  | Example           |
| --------- | ----------------------------------------- | ----------------- |
| `with<X>` | HOF that runs a callback inside a context | `withJestContext` |
| `make<X>` | factory whose result is itself a function | `makeExcluder`    |

**Framework conventions** — where the ecosystem's prefix is required, it wins:

| Prefix                   | Contract                                                                                                                | Example          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `use<X>`                 | React hook — the prefix drives rules-of-hooks linting; helpers inside a hook follow the normal taxonomy                 | `useDebounce`    |
| `on<Event>`              | event-callback prop or parameter                                                                                        | `onRowClick`     |
| `handle<Event>`          | local implementation passed to an `on<Event>` prop — the idiomatic React pair; the `handle` ban applies everywhere else | `handleRowClick` |
| `handle<LifecycleEvent>` | implementation of an engine lifecycle callback, keyed by the engine's lifecycle-event enum                              | `handleTick`     |

**Banned** — each is a vaguer or synonymous form of a listed verb; use that one instead: `handle`
(except the `handle<Event>` framework conventions), `process`, `manage`, `do`, `perform` (say what
it does), `execute` (→ `run`), `compute` (→ `build`), `fetch` (→ `read`), `save`/`store` (→
`write`), `delete` (→ `remove`), `search`/`lookup` (→ `find`/`get`).

Algorithm-native vocabulary (`walk`, `backtrack`, `slideDiagonal`) is allowed inside the module
implementing that algorithm — forcing list verbs onto textbook terms hides the algorithm.

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
