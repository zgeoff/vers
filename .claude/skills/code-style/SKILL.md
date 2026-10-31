---
name: code-style
description:
  Code style for zgeoff TypeScript repos — module layout and file naming, acronyms, state
  lifecycles, branching on a union with ts-pattern, type claims, structure, errors and logs,
  comments, one-off codemods, and the role table of function verbs whose promises the function-verb
  and verb-contract lint rules check. Load before writing, reviewing, or renaming any TypeScript,
  with the repo's project-code-style skill beside it.
metadata:
  kind: rule-set
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
- [Naming values](#naming-values): a variable, parameter or property is named for what it holds, in
  full words, with no single letters or abbreviations outside a short kept list.
- [State lifecycles](#state-lifecycles): persisted state moves through one declared transition
  table, and an in-process actor is an xstate machine.
- [Branching on a union](#branching-on-a-union): branch with `match(...).exhaustive()` from
  `ts-pattern`, never `switch`.
- [Type claims](#type-claims): no type assertion and no `any` value reaching a typed place; narrow
  or parse instead.
- [Structure](#structure): typed contracts between processes, decisions split from I/O, no
  forwarding layer or unused option, and I/O through given dependencies.
- [Errors and logs](#errors-and-logs): return an expected outcome, guard only what can be wrong,
  assert what only a bug reaches, and log nothing per call on a hot path.
- [Comments](#comments): a `//` comment holds only the reason the obvious alternative is wrong, when
  the cause lives outside the file.
- [Mechanical changes](#mechanical-changes): a one-off codemod goes in the PR description, never
  into the repo.
- [Function naming](#function-naming): a function that does a job in the role table starts with that
  job's verb and keeps its promise, and the banned verbs never appear.

## Loading the skill

This skill is the shared base that repo-sync delivers from zgeoff/tools; edit it there, never in a
downstream repo. When the repo has a `project-code-style` skill, load it too. It holds the repo's
own rules, and it only adds to this skill: a stricter rule, never an exception.

## Files and modules

- One primary export per file, and the file name kebab-cases that export (`with-jest-context.ts`
  exports `withJestContext`). Exceptions: `index.ts` entrypoints, `types.ts` for a package's shared
  types, and side-effect-only modules, which are named for what they do (`augment-bun-test.ts`).
- Module order: imports, the primary export, then private helpers in composition order (depth-first)
  — never helpers first. Supporting declarations (consts, interfaces, type aliases) sit directly
  above their first use, never below it and never leading the file. The exception: declarations the
  primary export uses may sit just above it. `zgeoff/module-order` reports each break, and its fix
  moves each declaration it can move safely.
- Build objects with a factory function, never a class. The factory takes the verb its result needs:
  `build<X>` for a value, `create<X>` for a resource, and `make<X>` for a function. The one
  exception is a custom error, `class <X>Error extends Error`, since `instanceof` checks and stack
  traces need it. `zgeoff/no-class` fails any other class.

## Acronyms

Acronyms stay uppercase in identifiers (`runCLI`, `parseCLIArgs`, `ASTNode`, `packageURL`,
`isPackageJSON`) — except when one starts a camelCase name, where it lowercases whole (`cliPath`,
`astNode`). ID counts as an acronym: `userID`, `sessionID` — never `userId` — and `idToken` when it
starts a name. File names are unaffected: kebab-case lowercases everything (`parse-cli-args.ts`
exports `parseCLIArgs`).

## Naming values

Name a variable, parameter or property for what it holds, in full words: `manager`, never `mgr`, and
`session`, never `s`. A full word tells the reader what the value is without a trip to where it was
made. Single letters and abbreviations are banned.

A few short names are kept:

- `x` and `y`, for coordinates.
- `z` for zod, `$` for Bun's shell, and `_` for a placeholder that is never read.
- `ctx` and `id`.
- `db`, `args`, `params`, `repo` and `info`, which read as words.

A unit keeps its short form as a suffix, as in `timeoutMs`, but `ms` alone never names a value.
Acronyms follow [Acronyms](#acronyms). A type parameter, such as `T`, is not a value, and this rule
leaves it alone.

Lint catches the mechanical cases. `id-length` fails a one-letter name other than the kept ones, and
`zgeoff/no-abbreviated-names` fails each abbreviation its options list, with the full word in its
message. An abbreviation outside that list, such as `cfg`, breaks this rule all the same.

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

## Branching on a union

Branch on a union with `match(...).exhaustive()` from `ts-pattern`, never with `switch`. The
`exhaustive()` call fails the type check when a member of the union has no branch, so a member added
later cannot fall through to a default. `zgeoff/no-switch` reports every `switch`, but only the
author can tell a union from an open value. End the match with `.otherwise()` only when the value is
open, such as a string from outside the program.

## Type claims

A type the checker cannot confirm is a claim, and the checker trusts it everywhere the value goes.

- Replace a type assertion with a type guard, a type annotation, `satisfies`, or a parse with a
  schema. Lint bans every assertion except `as const`. An assertion that survives carries a disable
  comment with its approval and reason, as the `@zgeoff/oxlint-config` README shows, and review
  reports each new one, so the maintainer sees every cast the repo gains.
- Never let an `any` value reach a typed parameter, return or variable. Type it `unknown` and narrow
  it, or parse it with a schema. `JSON.parse` and some library calls return `any`, and lint cannot
  see the claim, because `any` turns the type check off.

## Structure

Each of these rules keeps the next change small.

- An interface between processes or packages goes through the repo's typed contract, such as a typed
  RPC layer, a shared schema or the CLI library's argument parser. A hand-matched route, a
  hand-parsed body or hand-read arguments drift from the other side with no type error.
- A function that both branches heavily and does I/O splits in two: a pure step that decides what to
  do, and a thin step that does it. A test then covers each branch with values.
- A layer adds behaviour. A wrapper that only forwards its arguments goes, and its callers call the
  wrapped function.
- Every option, parameter and extension point has a caller. Add one when its first caller needs it,
  because one that nothing passes is code that no test runs.
- A unit reaches I/O through the dependencies its caller passes in, never by importing a client or
  calling a global, so a test passes a stand-in at the boundary.

## Errors and logs

- Return an expected outcome, such as a miss or a refused input, as a result. Throw only for a
  failure the caller cannot plan for.
- Guard only a value that can be wrong. A check on a value whose origin already guarantees it is
  dead code, and it tells the reader the guarantee does not hold.
- Input from outside the process, such as a request body, a file or an environment variable, gets a
  handled error, never an assertion, because bad outside input is expected.
- A condition that only a bug can reach gets an assertion, never a normal branch, so the bug fails
  where it starts instead of running on.
- Log a failure, a state change or a slow path. A log on a hot path or a success path repeats on
  every call and buries the lines an operator needs.

## Comments

A fact a reader needs has a home that stays true: the code, a type, a named constant, a test whose
name states the rule, the commit body, or the subsystem's architecture doc for an invariant that
callers obey. A comment holds only the residue none of those can hold.

- Write a `//` comment for one thing: the reason the obvious alternative is wrong, when the cause
  lives outside the file. A library defect, a harness quirk, a runtime or platform behaviour, a
  parser or compiler rule, a measured number, a production incident. Place it at the line or
  declaration it explains, three lines at most.
- Never write what the code shows: what a function does, its parameters, its outcomes, an invariant
  a test already states, which step does what. An agent derives those from the code, its tests, and
  its references; a comment that caches them goes stale.
- A caller-facing contract is a test whose name states it. An invariant that code in another package
  obeys is stated in the subsystem doc as well. The reason for a design decision lives in the commit
  body, never in the doc. A reason a reader needs at the line follows the `//` rule.
- Comments describe the code as it is now — no history ("previously", "now uses"), no project state
  (issue numbers, phase labels, "not wired yet"); those live in the commit message.
- Comments don't name other declarations, because a rename strands the reference. State the fact
  instead: "a retry after the deadline is dropped", not "(see scheduleRetry)". A declaration's own
  parameters and signature types are fine to name.

## Mechanical changes

A codemod or other one-off script that made a mechanical change never enters the repo. Put it in the
PR description, in a collapsed `<details>` block with the command that ran it, so a reviewer can
rerun it and the tree keeps no script that nothing runs again. The formatter and the lint fixes that
the repo runs on every commit are not one-off scripts, and this rule leaves them alone.

## Function naming

A function that does a job in the role table starts with that job's verb, and the verb makes a
promise the reader relies on without opening the function. Any other function starts with any verb
that fits what it does. `zgeoff/function-verb` fails a banned verb, and `zgeoff/verb-contract` fails
each broken promise that a machine can see. The `@zgeoff/oxlint-config` README lists what
verb-contract counts as I/O.

| Role                                                  | Verb                         | Promise                                     |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| yes/no answer                                         | `is`, `has`, `can`, `should` | returns a boolean; no I/O                   |
| yes/no answer that needs I/O                          | `probe`                      | returns a boolean; may do I/O               |
| value from arguments, test data factories included    | `build`                      | no I/O                                      |
| text or raw input → structure                         | `parse`                      | no I/O                                      |
| value → text or markup                                | `format`, `render`           | no I/O                                      |
| choice among known alternatives                       | `pick`                       | no I/O                                      |
| lookup that can miss                                  | `find`                       | no I/O; can return null or undefined        |
| lookup that cannot miss                               | `get`                        | no I/O; never returns null or undefined     |
| many values gathered from a traversal                 | `collect`                    | no I/O                                      |
| cheap change of representation                        | `to`                         | no I/O                                      |
| content in from outside the process                   | `read`                       | may do I/O                                  |
| content out to outside the process                    | `write`                      | may do I/O                                  |
| subprocess or task                                    | `run`                        | may do I/O                                  |
| resource brought into existence                       | `create`                     | may do I/O                                  |
| resource taken away                                   | `remove`                     | may do I/O                                  |
| function that returns a function                      | `make`                       | returns a function                          |
| higher-order wrapper                                  | `with`                       | runs a callback inside a context            |
| React hook                                            | `use`                        | follows the rules of hooks                  |
| event-callback prop or parameter                      | `on`                         | follows the framework's callback convention |
| function passed to an `on` prop, or a lifecycle event | `handle`                     | follows the framework's callback convention |
| test wiring                                           | `setupTest`                  | the testing skill's per-test fixture        |

`make`, `with`, `use`, `on` and `to` always take a suffix, as in `toPosixPath`.

### The I/O rule

A function that does I/O starts with a verb that may do I/O, and never with a verb whose promise is
no I/O. A pure function stays pure all the way down: a `build` function that calls a `read` helper
does I/O. verb-contract skips a callee from a package, so a pure function that calls a package's
I/O, or a local helper whose name hides its I/O, passes lint and still breaks the rule.

A function that returns a boolean and does no I/O starts with `is`, `has`, `can` or `should`. Two
exceptions:

- A function with an effectful verb, such as `removeFile` or `tryLock`, may return a success flag.
- A framework prefix wins: a React hook that returns a boolean keeps `use`, and a callback keeps
  `on` or `handle`.

### Data or resource

A test data factory is `build<X>`, never `create<X>` or `make<X>`. `create` is for a resource, such
as a file, a stub binary or a server.

### Free verbs

A function whose job has no row in the table may start with a verb outside it. That verb is free: it
makes no promise. A job with a row keeps its row's verb, so a pure yes/no answer starts with `is`,
`has`, `can` or `should` even when a free verb such as `matches` reads well. `resolve` is free
because it names both a pure lookup and one that searches the filesystem, so a reader opens a
`resolve` function to learn which.

### Banned verbs

Banned verbs never start a function name. The vague ones say nothing about what the function does,
so name what it does instead: `process`, `manage`, `do`, `perform`, and `handle` outside its
callback use. The others are near-synonyms of a table verb, and lint names the replacement:
`execute` (→ `run`), `compute` (→ `build`), `fetch` (→ `read`), `save` and `store` (→ `write`),
`delete` (→ `remove`), and `search` and `lookup` (→ `find`).

### Changing the table

A change to the role table, to the banned verbs, or to the effectful verbs that verb-contract counts
as I/O is a change to zgeoff/tools, where the skill and both rules change in one PR, and it needs
the maintainer's approval. A new free verb needs no change and no approval.
