---
name: project-code-style
description:
  vers's own TypeScript style on top of the shared code-style skill — the names exempt from the
  function-verb rule, type-only modules, invariants, untyped column boundaries, third-party
  packages, Panda CSS styling and screens, Zustand client state, and the lint directives. Load it
  beside code-style before writing, reviewing, or renaming any TypeScript in vers.
---

# vers code style

The shared `code-style` skill holds the base rules: module layout, acronyms, state lifecycles, and
the shared function-verb taxonomy. This skill holds only what vers adds. Load both; this skill adds
and tightens rules and never relaxes one from the base.

## Key rules

- [Exempt names](#exempt-names): a library method whose fixed name starts with a banned verb sits in
  the `exemptNames` option of `zgeoff/function-verb`.
- [Type-only modules](#type-only-modules): shared types go in the directory's one `types.ts`.
- [Invariants](#invariants): a true invariant uses `tiny-invariant`, never a hand-rolled throw.
- [Untyped column boundaries](#untyped-column-boundaries): a jsonb or text value re-enters typed
  code through its schema's `.parse`, never an `as` cast.
- [Third-party packages](#third-party-packages): prefer an established, narrowly scoped package over
  hand-rolling.
- [Styling](#styling): Panda CSS 2.0 values outside the theme take the bracket escape hatch, and
  screens compose design-system components and semantic tokens.
- [Client state](#client-state-zustand): one bound store per package, state only, written through
  external setters.

## Exempt names

`zgeoff/function-verb` reports only a name that starts with a banned verb, so any other name needs
no exemption. An oRPC handler keeps the name of its contract procedure, because the contract key is
the public API's vocabulary and a rename would misname it. A method that implements a library's
interface keeps the name the library calls. When either name starts with a banned verb, it goes in
the `exemptNames` option of `zgeoff/function-verb` in [`.oxlintrc.json`](../../../.oxlintrc.json).
An option that only takes a function, such as the `fetch` option of `Bun.serve`, needs no exemption:
pass it a named function that follows the verb rule, such as `handleRequest`.

- `deleteCookie`, the TanStack Start cookie helper that the web app's request-context mock stands in
  for
- `executeQuery`, the query method of a Kysely database connection

## Lint directives

Every type-aware rule is on in [`.oxlintrc.json`](../../../.oxlintrc.json), except two that the
shared config turns off: `typescript/prefer-readonly-parameter-types`, and
`typescript/no-unsafe-type-assertion`, whose every report the ban on all type assertions includes.
The documented app-web override for `only-throw-error` is permanent.

- A type assertion is never baselined. It survives only with the approval comment that the
  `@zgeoff/oxlint-config` README shows.

- Baseline a pre-existing violation inline with
  `// oxlint-disable-next-line <rule> -- baseline(#236)`, never by turning the rule off in config.
  The unused-directive check is the ratchet: fixing a baselined site strands its comment, and lint
  fails until the comment is deleted.
- In authored code, `zgeoff/no-jsdoc`, `zgeoff/max-consecutive-line-comments` and
  `vers/no-unportable-math` are never baselined and never disabled inline. Generated output goes in
  `ignorePatterns` in [`.oxlintrc.json`](../../../.oxlintrc.json). Rewrite an operation
  `vers/no-unportable-math` rejects to use an allowed operation. The `Comments` section of the
  shared `code-style` skill gives the home for a fact a rejected comment held.

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
type goes through the one documented converter, [`toJSON`](../../../libs/data/db/src/to-json.ts)
from `@vers/db`.

## Third-party packages

Prefer an established, narrowly scoped third-party package over hand-rolling the same logic —
recommend one whenever it covers the need. Hand-roll only when no candidate is both proven and
focused on the problem, when a Bun or Node builtin already covers it, or when the logic is small
enough that a dependency costs more than it saves.

## Styling

Panda CSS 2.0 spans `@vers/panda-preset`, `@vers/styled-system`, `@vers/design-system`, and app-web,
pinned at 2.0.0-beta.8 in the catalog — no stable 2.0 release exists.

- [`@vers/panda-preset`](../../../libs/design/panda-preset/src/preset.ts) composes
  `presets: [presetBase, presetPanda]` — Panda 2.0 ships no bundled default preset.
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
  `create<Store>()(() => ({ … }))`. A package with a second genuinely disjoint domain
  (game-rendering's satellite registry beside its scene state) may hold a second store.
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
  ([game-rendering](../../../docs/architecture/game/game-rendering.md)); DOM components subscribe
  through selector hooks.
