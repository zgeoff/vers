# Claude Code mod checks

A Claude Code mod's hooks run inside the Claude Code host, not under Bun, so their tests run there
too. The [behavioral principles](../SKILL.md#principles) and the rules on structure, data, and
assertions apply. Bun's preload, its matchers, and its module mocks do not reach a mod check.

## Running checks

- A check is `<hook>.claude-check.ts` beside the hook it tests. `bun test` never collects it,
  because `bun test` cannot host a hook.
- `claude plugin test <dir>` runs every `*.test.ts` and `*.test.tsx` under the directory, each file
  in a child of the `claude` binary, in an environment like the one the hooks run in: no filesystem,
  network, or process access.
- A root `package.json` script copies the mod to a temp directory, renames each `*.claude-check.ts`
  to `*.test.ts`, then runs `claude plugin validate` and `claude plugin test` on the copy. Both run
  under `env -i` with `CLAUDE_CONFIG_DIR` inside the temp directory, so the person's configuration,
  installed plugins, and environment never reach the run.
- A check imports what a hook module imports: the mod's own files by relative path, and the host's
  modules. Any other import fails the file with
  `a hooks module imports its own files by relative path and "claude-code", nothing else`. So
  `invariant`, faker, jest-extended, and MSW cannot load.

## The kit

A check imports `expect` and `test` from `claude-code/testing`. The module exports `describe`,
`expect`, `mock`, `test`, and `tier`; `describe` stays banned, as in Bun tests.

- `test(name, ($, on) => …)` or `test(name, { options, plugins, timeoutMs }, ($, on) => …)`. `$` is
  the engine. Hooks the test registers on `on` sit beneath every plugin and answer in the engine's
  place; an event that no hook answers rejects with `no implementation for <event>`.
- Each test loads the mod into a fresh host. Module state and registered hooks do not carry from one
  test to the next, which does the job of the preload's resets.
- `mock.clock(on, { now })` answers `$.clock` from a clock that moves only when the test advances
  it. `mock.store(on, entries)` answers `$.store` from memory, `mock.env(on, variables)` answers
  `$.env.get`, and `mock.session(on)` records what plugins append to the session.
- The kit has no `test.each`, no `mock()` recorder, no `onTestFinished`, and no `beforeAll`,
  `beforeEach`, `afterEach`, or `afterAll`. Its matchers are its own set: `toStartWith` and
  `toEndWith` share a name with jest-extended, and the other jest-extended matchers are absent.
- The full declarations live in `.claude-plugin/types/claude-code/index.d.ts`, which the host writes
  only when it loads the mod from a folder the person owns. A repo ignores that folder, so CI never
  has it. The mod keeps a local `testing.d.ts` that declares `claude-code/testing` with only what
  the real module offers, each signature copied from the host's. A member the kit lacks passes
  typecheck and fails at run time.

## How the rules map

- A closed decision table becomes separate tests, one per row.
- A call recorder is an inline array that an `on(…)` handler fills. The test asserts the array once
  the act returns.
- A maybe-value narrows through a small `assertDefined` in the test utils, with its own check,
  because `invariant` cannot load.
- A factory takes fixed defaults throughout, because faker cannot load. Each factory carries a
  comment that says so.
- Shared check utilities, factories and stand-ins included, live in the mod's `hooks/test-utils/`,
  each with its own check. The mod's `.npmignore` excludes `hooks/test-utils/` and every
  `*.claude-check.ts`, so the published package carries neither.

```ts
test('it runs the classifier once for an ask', async ($, on) => {
  const runs: (readonly string[])[] = [];

  on('tool.check', () => buildMockPermissionDecision({ decision: 'ask' }));
  on('process.run', (_api, input) => {
    runs.push(input.argv);

    return { value: buildMockProcessResult({ stdout: '{"decision":"allow"}' }) };
  });

  await $.tool.check({ tool: 'Bash', input: { command: 'git push' } });

  expect(runs).toHaveLength(1);
});
```

## Thrown errors

The host reports a hook that throws as skipped and continues the chain without it. The caller then
receives the host's own error, such as `no implementation for process.run`, and the thrown message
appears only in the failure report under `the engine reported`. A check cannot assert a thrown
message. A branch reachable only through that message cannot be checked: name it in a comment where
the stand-in throws.

## Time

A mod reads the wall clock, `Date.now()`, for deadlines and record timestamps. Its checks assert a
two-sided range around the act: capture `Date.now()` before and after the act, then check that the
value falls between them. `Date.now()` is not monotonic, so a clock adjustment can end a deadline
early or late; a mod uses it anyway because the deadline crosses into another process, which a
monotonic clock cannot do.

A mod never reads `$.clock.now()`, even though `mock.clock` would make its values exact. `clock.now`
is a host event that any installed plugin can hook, so reading it lets another plugin move a
deadline or a recorded start time, and a rejected call adds failure paths that the mod must handle.
This is the mod exception to the time ranking in [Time and waiting](../SKILL.md#time-and-waiting).
