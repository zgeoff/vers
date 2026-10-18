---
name: code-style
description:
  Code style for zgeoff TypeScript repos — module layout and file naming, acronyms, state
  lifecycles, and the closed function-verb taxonomy that the function-verb lint rule enforces. Load
  before writing, reviewing, or renaming any TypeScript, with the repo's project-code-style skill
  beside it.
---

# Code style

Mechanically enforced rules (oxfmt, oxlint, format-codemod) aren't repeated here — this skill covers
what tooling can't check.

## Key rules

Each line links the section that explains it.

- [Files and modules](#files-and-modules): one primary export per file, named for it, with private
  helpers after it.
- [Acronyms](#acronyms): acronyms stay uppercase in identifiers, `ID` included, unless one starts a
  name.
- [State lifecycles](#state-lifecycles): persisted state moves through one declared transition
  table, and an in-process actor is an xstate machine.
- [Function naming](#function-naming): every function name starts with a verb from the closed list,
  and the banned verbs never appear.

## Loading the skill

This skill is the shared base that repo-sync delivers from zgeoff/tools; edit it there, never in a
downstream repo. When the repo has a `project-code-style` skill, load it too. It holds the repo's
own verbs, exempt names, and rules, and it never relaxes a rule here.

A `project-code-style` skill lists each of the repo's verbs as a bullet or a table row that starts
with the backticked verb under `## Project verbs`, and each exempt name the same way under
`## Exempt names`, so an agent sees every verb it may use when the skill loads.
`check-project-verbs.sh`, beside this skill, fails when those lists differ from the `verbs` and
`exemptNames` options of `zgeoff/function-verb` in [`.oxlintrc.json`](../../../.oxlintrc.json), and
docs-writing's `check-length.sh` runs it.

## Files and modules

- One primary export per file, and the file name kebab-cases that export (`with-jest-context.ts`
  exports `withJestContext`). Exceptions: `index.ts` entrypoints, `types.ts` for a package's shared
  types, and side-effect-only modules, which are named for what they do (`augment-bun-test.ts`).
- Module order: imports, the primary export, then private helpers in composition order (depth-first)
  — never helpers first. Supporting declarations (consts, interfaces, type aliases) sit directly
  above their first use, never below it and never leading the file; types for the primary export's
  signature may sit just above it.

## Acronyms

Acronyms stay uppercase in identifiers (`runCLI`, `parseCLIArgs`, `ASTNode`, `pkgURL`,
`isPackageJSON`) — except when one starts a camelCase name, where it lowercases whole (`cliPath`,
`astNode`). ID counts as an acronym: `userID`, `sessionID` — never `userId` — and `idToken` when it
starts a name. File names are unaffected: kebab-case lowercases everything (`parse-cli-args.ts`
exports `parseCLIArgs`).

## State lifecycles

State that is persisted, or that leaves the process (sent to a client or another process), moves
through a declared transition table: the states, the moves allowed between them, and one check, in
the one place that writes the state, that refuses a move the table lacks. A long-lived actor whose
states live only inside one process, such as a reconnecting transport or an interactive client, is
an xstate machine instead, because its states last only as long as the process and xstate keeps its
events, guards and timers in one definition. An actor that persists part of its state keeps a
transition table for that part. Write the table before a module that owns the state splits, so the
modules the split creates share one copy of the rule instead of each keeping its own.

## Waiting on time and events

Wait on a timer with `Bun.sleep` in a script or test that only Bun runs. Code that ships to Node
waits with `setTimeout` from `node:timers/promises`, because Node has no `Bun` global. Wait on one
event with `events.once`. When a caller resolves a promise from outside, take the parts from
`Promise.withResolvers()`. Hand-build a `new Promise` only when none of these fits, such as an event
that can also fail through a second event.

## Function naming

Every function name starts with a prefix from the closed list below. The prefix is a contract — a
reader should know the function's shape without opening it. A verb that any repo could use extends
this list and the lint rule's list in zgeoff/tools in one PR, and a test there fails when the two
differ. A verb that only one repo needs goes in that repo's
[`.oxlintrc.json`](../../../.oxlintrc.json), under the `verbs` option of `zgeoff/function-verb`, and
in its `project-code-style` skill.

**Predicates** — return boolean, no side effects:

| Prefix   | Contract                | Example          |
| -------- | ----------------------- | ---------------- |
| `is`     | type or state test      | `isVarDecl`      |
| `has`    | containment, possession | `hasBlankLine`   |
| `can`    | capability              | `canResize`      |
| `should` | policy decision         | `shouldSkipFile` |
| `needs`  | requirement             | `needsBlankLine` |

**Pure producers** — result comes from arguments alone, no side effects:

| Prefix                        | Contract                                                                  | Example             |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------- |
| `build<Result>[From<Source>]` | default constructor for values; drop `From<Source>` when no single source | `buildEditsFromAST` |
| `define<X>`                   | identity; its only job is compile-time constraint of its literal argument | `defineErrors`      |
| `parse`                       | unstructured input → structure, invalid input reported                    | `parseSource`       |
| `encode`                      | structure → its defined compact or wire form, reversed by `decode`        | `encodeState`       |
| `decode`                      | `encode`'s output → the original structure, malformed input reported      | `decodeState`       |
| `derive`                      | one-way cryptographic derivation from secret material                     | `deriveAvatarKey`   |
| `plan`                        | compute an action without performing it                                   | `planGapEdit`       |
| `pick`                        | select among known alternatives                                           | `pickMode`          |
| `find`                        | search that can miss — null/undefined on miss                             | `findPrevious`      |
| `get`                         | cheap access that cannot miss (throwing on a broken invariant is fine)    | `getNodeEnd`        |
| `collect`                     | gather from a traversal or scan                                           | `collectChildNodes` |
| `count`                       | how many                                                                  | `countNewlines`     |
| `split`                       | one value → parts                                                         | `splitLines`        |
| `merge`                       | parts → one value                                                         | `mergeWindows`      |
| `sort`                        | reorder                                                                   | `sortEdits`         |
| `format`                      | value → human-readable string                                             | `formatRange`       |
| `render`                      | structure → output text or markup                                         | `renderHunk`        |
| `normalize`                   | variant forms → the canonical form                                        | `normalizePath`     |
| `sanitize`                    | untrusted input → a safe form, unsafe parts stripped or escaped           | `sanitizeTitle`     |
| `resolve`                     | follow indirection to a concrete value                                    | `resolveBinPath`    |
| `expand`                      | compact form → full form                                                  | `expandInputs`      |
| `compress`                    | value → its reversible compact encoding                                   | `compressGraph`     |
| `decompress`                  | reverse a `compress` encoding (non-encoded shorthand is `expand`)         | `decompressGraph`   |
| `to<Result>`                  | cheap representation change                                               | `toPosixPath`       |
| `transform`                   | a package's own source→source operation                                   | `transform`         |

**Effectful** — touches the world (filesystem, streams, processes, registries):

| Prefix         | Contract                                                                                                                                | Example            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `apply`        | perform previously planned changes                                                                                                      | `applyEdits`       |
| `create`       | bring a resource into existence (file, directory, process)                                                                              | `createWorkDir`    |
| `mint`         | issue a new unique token, ID or credential                                                                                              | `mintSessionToken` |
| `open`         | acquire a handle that stays live until closed (file, socket, connection)                                                                | `openDatabase`     |
| `dispose`      | free an object's resources so it can no longer be used                                                                                  | `disposeTerminal`  |
| `claim`        | atomically take exclusive ownership of a work item or resource; ownership ends at commit or an explicit release                         | `claimNextChain`   |
| `release`      | give back a hold taken earlier (a lock, a lease, a claim)                                                                               | `releaseLock`      |
| `revoke`       | withdraw a grant (token, permission, credential) so it stops working                                                                    | `revokeToken`      |
| `read`         | pull raw content from filesystem or network into memory                                                                                 | `readSource`       |
| `load`         | read **and** parse into a ready structure                                                                                               | `loadConfig`       |
| `write`        | persist to the filesystem                                                                                                               | `writeOutput`      |
| `remove`       | delete a resource                                                                                                                       | `removeStaleDist`  |
| `update`       | mutate existing state or resource in place                                                                                              | `updateIndex`      |
| `refresh`      | replace cached or stale state with a fresh read                                                                                         | `refreshSessions`  |
| `upsert`       | single-statement insert-or-update keyed by a natural or composite key, refreshing the conflicting row's columns in place                | `upsertUser`       |
| `set`          | assign a store's named state slice wholesale — the store-setter idiom; partial mutation is `update`                                     | `setSelectedNode`  |
| `toggle<Flag>` | invert a boolean state slice                                                                                                            | `toggleDevCamera`  |
| `reset`        | return state to its initial value                                                                                                       | `resetCombatState` |
| `restore`      | bring back a saved earlier state                                                                                                        | `restoreSnapshot`  |
| `print`        | write to stdout/stderr                                                                                                                  | `printHelp`        |
| `record`       | append an observation to a log, history or metrics store                                                                                | `recordUsage`      |
| `run`          | execute a subprocess, task, or whole pipeline                                                                                           | `runCLI`           |
| `spawn`        | launch a child process or task without waiting for it to end (`run` waits)                                                              | `spawnWorker`      |
| `schedule`     | arrange work to run later or on a timer                                                                                                 | `scheduleRetry`    |
| `check`        | evaluate and report findings; effects allowed per mode                                                                                  | `checkFile`        |
| `try<X>`       | X with failures captured as a value instead of a throw                                                                                  | `tryCheckFile`     |
| `register`     | add to a registry the caller doesn't own                                                                                                | `registerMatcher`  |
| `subscribe`    | attach a listener to an event source, returning or enabling detachment                                                                  | `subscribeToTicks` |
| `unsubscribe`  | detach what `subscribe` attached                                                                                                        | `unsubscribe`      |
| `assert`       | throw when an invariant doesn't hold                                                                                                    | `assertSpan`       |
| `require`      | throw unless a runtime condition holds — a guard real input can trip (`assert` covers invariants)                                       | `requireAuth`      |
| `verify`       | test a claim or credential against evidence, rejecting on mismatch                                                                      | `verifySession`    |
| `emit`         | dispatch an event or notification                                                                                                       | `emitProgress`     |
| `send`         | transmit a payload to a remote receiver (fire-and-forget or RPC — no resource semantics; REST mutations are `create`/`update`/`remove`) | `sendWebhook`      |
| `wait`         | block until an event or condition resolves; may return the awaited value                                                                | `waitForMessage`   |
| `setup`        | prepare the environment or fixture the following code assumes; `teardown` reverses it                                                   | `setupTest`        |
| `teardown`     | release what `setup` prepared                                                                                                           | `teardownTest`     |
| `start`        | put a long-running resource into service (server, worker, poll loop); `stop` reverses it                                                | `startQueues`      |
| `stop`         | take a long-running resource out of service, releasing what `start` acquired                                                            | `stopWorker`       |
| `restart`      | stop then start a long-running resource again                                                                                           | `restartDaemon`    |
| `advance`      | move a cursor, clock or state machine forward                                                                                           | `advanceTurn`      |
| `drain`        | consume a pending backlog until empty                                                                                                   | `drainJobs`        |

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
