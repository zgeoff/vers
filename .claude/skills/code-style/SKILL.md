---
name: code-style
description:
  "Code style for zgeoff TypeScript repos: file layout, names, state, unions, types, structure,
  errors, comments, and the function-name verb table. Load it before you write, review or rename
  TypeScript, with the repo's project-code-style skill beside it, for its stricter rules and its
  departures."
metadata:
  kind: rule-set
---

# Code style

## Files and modules

- Give each file one main export, and name the file after it: `parse-cli-args.ts` exports
  `parseCLIArgs`. `index.ts`, `types.ts` and `constants.ts` have no main export. Name a module that
  only has a side effect for what it does: `augment-bun-test.ts`.
- Order a file as imports, the main export, then its helpers in the order it calls them. Put each
  type or constant just above its first use.
- No classes, except a custom error (`class QuotaError extends Error`). Make objects with factory
  functions.

## Names

- Write an acronym in capitals: `parseCLIArgs`, `userID`, `packageURL`. At the start of a camelCase
  name, write it in lowercase: `cliPath`, `idToken`.
- Name a value for what it holds, in full words: `session`, not `s`; `manager`, not `mgr`.
- You may use these short names: `x` and `y` (coordinates), `z` (zod), `$` (Bun's shell), `_`
  (unused), `ctx`, `id`, `db`, `args`, `params`, `repo`, `info`.
- End a name with its unit: `timeoutMs`, never `ms` alone.

## State

- When a status is saved outside the process or sent to another process, write a transition table
  for it: its states, the moves allowed between them, and one function that checks a move. Keep all
  three in the only module that writes the status.
- Build a long-lived object whose states live only in memory, such as a reconnecting client, as an
  xstate machine.

## Waiting

- Sleep with `Bun.sleep` in Bun-only code, and with `setTimeout` from `node:timers/promises` in code
  that ships to Node.
- Wait for one event with `events.once`. When outside code settles a promise, make it with
  `Promise.withResolvers()`.
- Write `new Promise` by hand only when none of these fits.

## Unions

- Branch on a union with `match(value)…exhaustive()` from `ts-pattern`, never `switch`, so a new
  member fails the type check.
- End with `.otherwise()` only when the value comes from outside the program, such as a string.

## Types

- No type assertions except `as const`. Use a type guard, an annotation, `satisfies`, or a schema
  parse.
- When an assertion has to stay, get the maintainer's approval in the PR, and add a disable comment
  with the reason. In review, flag every new assertion, approved or not.
- Never let `any` reach a typed value. Make it `unknown` and narrow it, or parse it. `JSON.parse`
  returns `any`.

## Structure

- Send data between processes or packages through the repo's typed interface: its RPC layer, a
  shared schema, or its CLI parser. Never match a route, parse a body or read arguments by hand.
- Split a function that does I/O and branches on what it reads in two: a pure function that decides,
  and a thin one that acts.
- No wrapper that only passes its arguments on.
- No option, parameter or extension point until a caller passes it.
- Reach I/O through dependencies the caller passes in. Only the entry point builds real clients.

## Errors and logs

- Return an expected outcome, such as a miss or bad input from outside, as a value of the return
  type. Throw only what the caller can't plan for.
- Don't check what the value's source already guarantees.
- Call `invariant()` from `tiny-invariant` on a state that only a bug can reach.
- Log failures, state changes and slow calls. Never log each call of code that runs once per request
  or per item.

## Comments

- Write a `//` comment only to say why the obvious alternative is wrong, when the cause sits outside
  the file: a library bug, a runtime quirk, a measured number. Put it at the line, in three lines at
  most.
- Never restate what the code or a test shows.
- No history or project state ("previously", issue numbers, "not wired yet"). That goes in the
  commit.
- Put what callers rely on in a test name, such as `it returns null for an unknown ID`, not in a
  comment. When code in another package depends on an invariant of yours, also state it in the doc
  under `docs/` for that part of the system.
- Don't name another declaration in a comment; state the fact, so a rename can't leave it stale.

## One-off codemods

- Put a one-off codemod in the PR description, in a `<details>` block with the command that ran it,
  never in the repo.

## Function names

When a function's job has a row, start its name with that row's verb, and keep the row's guarantee.
Give any other function any verb that fits, except a banned one.

| Job                                                                                                       | Verb                         | Guarantee                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| yes/no answer                                                                                             | `is`, `has`, `can`, `should` | returns a boolean; no I/O                                                      |
| yes/no answer that needs I/O                                                                              | `probe`                      | returns a boolean; may do I/O                                                  |
| value from arguments, test data factories included                                                        | `build`                      | no I/O                                                                         |
| text or raw input → structure                                                                             | `parse`                      | no I/O                                                                         |
| value → text or markup                                                                                    | `format`, `render`           | no I/O                                                                         |
| choice among known alternatives                                                                           | `pick`                       | no I/O                                                                         |
| lookup that can miss                                                                                      | `find`                       | no I/O; can return null or undefined                                           |
| lookup that can't miss                                                                                    | `get`                        | no I/O; never returns null or undefined                                        |
| many values gathered from a traversal                                                                     | `collect`                    | no I/O                                                                         |
| cheap change of representation                                                                            | `to`                         | no I/O                                                                         |
| content in from outside the process                                                                       | `read`                       | may do I/O                                                                     |
| content out to outside the process                                                                        | `write`                      | may do I/O                                                                     |
| subprocess or task                                                                                        | `run`                        | may do I/O                                                                     |
| resource brought into existence                                                                           | `create`                     | may do I/O                                                                     |
| resource taken away                                                                                       | `remove`                     | may do I/O                                                                     |
| function that returns a function                                                                          | `make`                       | returns a function                                                             |
| higher-order wrapper                                                                                      | `with`                       | runs a callback inside a context                                               |
| React hook                                                                                                | `use`                        | follows the rules of hooks                                                     |
| event-callback prop or parameter                                                                          | `on`                         | follows the framework's callback convention                                    |
| function passed to an `on` prop, or a function that handles a framework lifecycle event such as a request | `handle`                     | follows the framework's callback convention                                    |
| a test file's per-test fixture                                                                            | `setupTest`                  | as the testing skill's [setupTest](../testing/SKILL.md#setuptest) section says |
| stored state put in place for a test, through the code of the module that writes it                       | `seed`                       | may do I/O; test code only                                                     |

- Keep a pure function pure all the way down: a `build` that calls a `read` does I/O. The
  `zgeoff/verb-contract` lint rule can't see I/O inside an npm package or behind a helper whose name
  hides it. Check those by hand.
- Start a function that returns a boolean and does no I/O with `is`, `has`, `can` or `should`, even
  when another verb reads well. An I/O verb may return a success flag (`removeFile`), and `use`,
  `on` and `handle` keep their prefix.
- Never use `make`, `with`, `use`, `on` or `to` as a whole name. Follow it with a noun, such as
  `toPosixPath`.
- Never start a name with `process`, `manage`, `do`, `perform`, `execute`, `compute`, `fetch`,
  `save`, `store`, `delete`, `search` or `lookup`, or with `handle` outside a callback. These verbs
  say nothing about I/O or a miss. For a database read that can miss, use `read` and return `null`.
  You may start a name with `resolve` whether or not it does I/O, such as for a pure lookup or a
  filesystem search.
