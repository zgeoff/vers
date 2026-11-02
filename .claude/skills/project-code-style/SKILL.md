---
name: project-code-style
description:
  "vers's own TypeScript rules beside the shared code-style skill: function names that a library or
  an oRPC contract sets, lint baselines and the lint rules never disabled, type-only modules,
  untyped database columns, single-statement writes, third-party packages, Panda CSS styling and
  screens, and Zustand client state. Load it beside code-style before you write, review or rename
  TypeScript in vers."
metadata:
  kind: rule-set
---

# vers code style

## Departures

- Keep the function name that a library or an oRPC contract sets, even when it starts with a verb
  that [Function names](../code-style/SKILL.md#function-names) in code-style bans. A library calls
  its interface's methods by name, and a contract's procedure names are the public API.

## Names

- Add each name that a library or a contract sets to the `exemptNames` option of
  `zgeoff/function-verb` in [`.oxlintrc.json`](../../../.oxlintrc.json), with a comment above it
  that names the library or the contract.
- Give a function that you pass as an option, such as the `fetch` option of `Bun.serve`, a name that
  follows the verb table in code-style, such as `handleRequest`. It needs no exemption.

## Lint directives

- Baseline a violation that predates a rule with
  `// oxlint-disable-next-line <rule> -- baseline(#236)` on the line above it. Use `#236`, the issue
  that turned the type-aware rules on, in each comment, and never turn the rule off in config. When
  you fix a baselined site, delete its comment: lint fails on an unused directive.
- Never baseline a type assertion. Each one needs the repo owner's approval in a review of its own
  PR, as code-style says, and a baseline skips that review.
- Never disable `zgeoff/no-jsdoc` or `zgeoff/max-consecutive-line-comments` in code you write,
  inline or by baseline. Put generated output in `ignorePatterns` in `.oxlintrc.json`.
- Never disable `vers/no-unportable-math`. The simulation core must replay to the same bytes on
  every engine build. When the rule rejects an operation, read its error, and rewrite the operation
  with one the rule allows.

## Types

- Put each type that two or more files in a directory use in that directory's `types.ts`, and create
  the file when it doesn't exist. Never write another module whose exports are all types.
- Read the value of an untyped jsonb or text column through the `.parse` of its zod schema, which
  the contract package of the service that owns the table exports, such as `EncounterNodeSchema`
  from `@vers/contract-activity`, so a malformed row fails at the read. When your code wrote the
  value and still holds its typed form, use that typed form instead.
- Pass a value that TypeScript can't prove fits a column's `Json` type through
  [`toJSON`](../../../libs/data/db/src/to-json.ts) from `@vers/db` before you write it.

## Database writes

- Keep a single-row invariant true in one statement: a conditional `UPDATE` or `DELETE … RETURNING`,
  an `INSERT … ON CONFLICT`, or a data-modifying CTE. One statement leaves no open transaction
  behind when a serverless process dies.
- Open `db.transaction()` only for an invariant across several rows.

## Third-party packages

- Use a package in place of hand-written logic when an established, narrowly scoped one covers the
  need. Recommend one in review when you see the logic written by hand.
- Write the logic yourself when no candidate is both widely used and focused on the problem, when a
  Bun or Node builtin covers it, or when the logic is smaller than the cost of a dependency.

## Styling

- Compose Panda's presets yourself, as
  [`preset.ts`](../../../libs/design/panda-preset/src/preset.ts) in `@vers/panda-preset` does with
  `presets: [presetBase, presetPanda]`. Panda 2 ships no default preset.
- Wrap each CSS value that isn't a theme token in brackets: `cursor: '[pointer]'`,
  `borderWidth: '[1px]'`. Panda 2's `SystemStyleObject` types reject a bare string or number.

## Screens

- Build a screen or a route from `@vers/design-system` components and the semantic tokens (`bg.*`,
  `text.*`, `border.*`, `accent.*`). Style nothing beyond layout: no one-off colors, fonts or
  animations.
- Never rename a semantic token. A re-skin changes token values only, so a screen that uses the
  tokens follows it with no change.
- When a screen needs a component that doesn't exist, build the smallest version in the screen's
  package, in its own PR. Move it into `@vers/design-system` when a second screen needs it.

## Client state

Zustand holds client state, and TanStack Query holds the server cache.

- Build one store per package, in one call to Zustand's `create`. Spread into it the slice
  factories, one per file, each named `create-<concern>-slice.ts`, where `<concern>` names the
  fields it holds. Each factory returns its fields' initial values and no functions.
- Add a second store only for a separate domain, such as the satellite registry beside the scene
  state in `@vers/game-rendering`.
- Keep functions out of the store. Write state through one setter per file (`set-*.ts`,
  `toggle-*.ts`) that calls `setState`, so a worker or an engine callback can write outside React.
- Call `setState` once per event. When an event changes several fields, write one setter for the
  event, never one per field.
- Export selector hooks and setters from `index.ts`, never the store that `create` returns. When
  another package reads state outside React, export a `get*` function for that read.
- Wrap a selector in `useShallow` only when it builds a new object or array. A selector that returns
  a stored value needs no wrapper.
- Apply middleware to the combined store, never to a slice. Middleware wraps the function you pass
  to `create`, and a slice factory only returns values.
- Inside the React Three Fiber frame loop, read state with the store's `getState()`, or with an
  exported `get*` function from another package, as
  [game-rendering](../../../docs/architecture/game/game-rendering.md) explains. Subscribe a DOM
  component through a selector hook.
