---
name: testing
description:
  Testing rules for zgeoff repos, covering where a test lives, test shape, setupTest and cleanup,
  test data, stored state seeded and read through the module that writes it, schemas, assertions,
  matchers, time, boundaries and speed. References cover seeding, slow tests and lanes, factories,
  databases, HTTP mocking, cleanup, observability, system tests, shell scripts, workflows and Claude
  Code mods, plus frontend, Go and NixOS where a repo uses them. Load it before you write or review
  a test. Load the repo's project-testing skill beside it, for the lanes and utils in its Facts
  table, and for its stand-ins; where they disagree, the project skill wins.
metadata:
  kind: rule-set
---

# Testing

## References

- [Seeding](./references/seeding.md): a seed, a seeder, and where to write rows directly.
- [Slow tests and lanes](./references/slow-tests.md): a slow test, the run mode, and a lane.
- [Factories](./references/factories.md): writing a factory.
- [Matchers](./references/matchers.md): a matcher for a kind of value.
- [Boundaries](./references/boundaries.md): the stand-in for each boundary, and module mocks.
- [Database](./references/database.md): a package that owns a schema.
- [HTTP mocking](./references/http.md): a package that calls a remote service.
- [Cleanup](./references/cleanup.md): cleanup order, and a test that fails only in the full run.
- [Observability](./references/observability.md): code that records telemetry.
- [System tests](./references/system-tests.md): end-to-end, evaluation, property and golden tests,
  native timers, and stateful stand-ins.
- [Shell scripts](./references/shell.md): a script's test.
- [Workflows](./references/workflows.md): a GitHub Actions step's logic.
- [Claude Code mod checks](./references/claude-code-mods.md): a mod's hooks.

<!-- repo-sync needs ./references/frontend.md -->

- [Frontend](./references/frontend.md): React and TanStack clients in a web app.

<!-- repo-sync end -->

<!-- repo-sync needs ./references/go.md -->

- [Go testing](./references/go.md): Go tests.

<!-- repo-sync end -->

<!-- repo-sync needs ./references/nixos.md -->

- [NixOS testing](./references/nixos.md): Nix evaluation and VM tests.

<!-- repo-sync end -->

## Principles

- Write each test so a reader understands it from its body alone.
- Make each test pass alone and in any order.
- Give each behaviour you add or change a test through the function the unit's callers call. The
  test fails when you revert the change.
- Test the behaviour, so a refactor that keeps it leaves every test green.
- Bring each test you touch in line with these rules.
- Never cut a test that checks behaviour. Never add one that checks nothing.

## The test run

- Reset shared state after each test in the test preload, the file that `bunfig.toml` lists under
  `[test] preload`. When you add module-level state, such as a cache, add its reset there.
- Override an environment variable through a helper in `src/test-utils/` that restores it after the
  test, never by assigning `process.env`.
- Start a shared resource, such as the MSW server, in the preload's `beforeAll`, never at import.
- Run the unit tests with `rig unit --no-isolate`, from
  [`@zgeoff/rig`](https://github.com/zgeoff/tools/tree/main/packages/rig). rig sets `--parallel`
  from the host's cores and memory, and `--no-isolate` lets the files share each worker's process.
  Never turn Bun's per-file isolation back on. It slows the suite and hides a leak between files.

## Where a test lives

Lay out each package like this made-up one:

```text
packages/ledger/
├── package.json                    exports "./test-utils/*"
├── src/
│   ├── record-payment.ts
│   ├── record-payment.test.ts      unit test, beside its module
│   ├── record-payment.bench.ts     benchmark of one module
│   ├── render-pdf.browser.test.ts  unit test in the browser lane
│   └── test-utils/
│       ├── start-ledger.ts         helper, with its own test
│       └── start-ledger.test.ts
├── e2e/
│   ├── start-ready.test.ts         the built program, run as a process
│   ├── journey-checkout.test.ts
│   └── fixtures/                   inputs that aren't code, such as a Dockerfile
├── evals/
│   └── categorise/                 one folder per evaluation
└── bench/
    └── import-statement.bench.ts   benchmark of the running program
```

| The test                                                     | Put it                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| starts a program that `rig.config.ts` declares, as a process | in `e2e/` of the package that builds the program, named with a prefix from [End-to-end suites](./references/system-tests.md#end-to-end-suites) |
| scores a corpus                                              | in `evals/<name>/` of the package whose code it scores, as [Evaluation suites](./references/system-tests.md#evaluation-suites) shows           |
| measures a running program                                   | in `bench/` of the package that builds the program, as [Benchmarks](./references/system-tests.md#benchmarks) shows                             |
| does anything else                                           | beside the module or script it tests                                                                                                           |

Put a shared helper in the package that owns what it starts, builds or fakes.

[`chex test-layout`](https://github.com/zgeoff/tools/tree/main/packages/chex) and rig fail a test
outside this layout.

## Test shape

- Check a config file, such as `package.json`, with a check script that CI runs, never with a test
  file, except as [Workflows](./references/workflows.md) shows.
- Write top-level `test()` calls, with no `describe`. Hooks in a `describe` couple its tests.
- Name the behaviour a caller sees in each title, as verb, outcome, condition:
  `it rejects a title longer than 120 characters`. In a file that tests several units, start the
  title with the unit: `#archiveNote rejects …`.
- Arrange, act, assert, with no phase comments. Write one act per test. Treat an earlier act the
  test depends on, such as saving the note it archives, as arrangement, and don't assert on it.
- Use `test.each` only for cases that differ in values, with rows of plain data or seed calls. Put
  the value that varies in the title.
- No loop of assertions. Use `test.each`, or one collection matcher:
  `expect(listOpenNotes(store)).toSatisfyAll((note: Note) => note.archivedAt === null)`.

## setupTest

- Put per-test setup in one local `setupTest()` that each test calls, and no hook such as
  `beforeEach` in a test file.
- In `setupTest()`, wire the temp directories, the database, the clock, servers, clients, recorders,
  the unit, and the [seeder](./references/seeding.md#buildseeder-and-setuptest). Create no data
  there. Give it no `if`, and no argument that a test's outcome depends on.
- Create each test's data in the test, even when every test needs the same. Set the time in each
  test whose code reads it.
- Declare nothing at module level but imports, `setupTest()` and tests.
- Keep each function that `setupTest()` returns, other than the seeder, to calls of production code,
  such as `readNotes: () => listNotes(db)`.
- Write one `setupTest()` per file, and never share it.
- Bind the result to one `const ctx`, never destructured.

```ts
async function setupTest() {
  const db = await createTestDatabase();
  const deps = { db, clock: buildStubClock() };

  return { ...deps, service: createNotesService(deps), seed: buildSeeder(deps) };
}

test('it lists the notes of a user with none as empty', async () => {
  const ctx = await setupTest();
  const user = await ctx.seed.user({ name: 'ada' });

  expect(await ctx.service.listNotes({ userID: user.id })).toStrictEqual([]);
});
```

## Cleanup

- Register `onTestFinished` right after each acquisition, so a later throw still releases it. No
  `try`/`finally` in a test.

```ts
const dir = mkdtempSync(join(tmpdir(), 'notes-'));

onTestFinished(() => rm(dir, { recursive: true, force: true }));
```

- When a test changes process state, register `onTestFinished` right after the change. Skip it for
  state that the preload already resets.
- Keep tests apart with the [test-database helper](./references/database.md) and a folder per test,
  never with random IDs: a list query still returns the other test's rows.

## Test data

- Keep plain inputs inline: write the literal again in the next test, never a shared fixture or a
  named constant.
- Give a type that crosses a module boundary, such as an SDK result, a tested `buildMock<Type>`
  [factory](./references/factories.md) in `src/test-utils/` on first use. Build only plain data in a
  factory, and write no rows or files.
- Build a stand-in for a boundary from data only. Use one of these:
  - a fixed answer;
  - `mock()`;
  - a no-op;
  - a map from input to answer;
  - the answer-queue helper in `src/test-utils/`.
- Move any logic in a stand-in to a tested helper in `src/test-utils/`.
- No `mockReturnValueOnce` or `mockResolvedValueOnce` chain: a call past the last answer returns the
  default silently, where the answer-queue helper throws.

## Stored state

Reach database rows and files on disk through the module that writes them. Only that module's own
tests may write them directly, when no seed makes the state.

- Outside the module's tests, read through its code: a read function for rows, a path helper for
  files. When none exists, add one, with a test.
- Seed through the module: `ctx.seed.archivedNote({ title: 'Groceries' })`. Write a base seed per
  kind of record, such as `note`, and one per other state, such as `archivedNote`, as
  [Seeding](./references/seeding.md) says.
- Never put the call under test, a clock move or a write to another record inside a seed, so the
  reader sees each one in the test.

## Schemas and parsers

- Feed inline literal payloads, never a factory's. Build each rejected payload from the valid
  literal with one field changed.
- Assert a rejection's issue path with `toPartiallyContain({ path: ['title'] })`, never `issues[0]`
  or a bare `success: false`. Assert an accepted payload's `result.data` with `toStrictEqual`.

## Assertions

- Assert the full contract with `toStrictEqual`, with an asymmetric matcher for a field the test
  doesn't decide, such as a generated ID. Never use `toEqual`. Use `toMatchObject` only for an
  error's code, or a raw row in the writing module's own test. When you read stored state back after
  a change, one `toBe` on the changed field is enough.
- Assert each result in its own `expect`, and the parts of one result in one `expect`, such as a
  command's exit code, stdout and stderr.
- Derive the expected value from the contract, never with the unit's own calculation.
- Never take a snapshot of a component: once updated, it passes whatever renders.

## Errors

- Assert at the strictness the contract needs: `toThrow()`, `toThrowWithMessage(Error, /…/)`, or
  `toMatchObject({ code })`.
- Give each declared error a test. For a throw that can't happen in production, delete the branch,
  or write `invariant()` from `tiny-invariant`.
- Never assert in a `try`/`catch`: when nothing throws, nothing is asserted.
- Write `.rejects` and `.resolves` without `await`, because Bun settles them inside the matcher.
  Always `await` `toResolve()` and `toReject()`: they return a promise, and a test that doesn't
  await it ends before the check runs.

## Access rules

- Test that the allowed caller succeeds, and that another caller is refused, named in its title:
  `it rejects a note owned by another user`.
- When a read hides a record, assert the hidden result, such as `toBeNull()`.

## Narrowing

- No branch in a test body. Give each path its own test.
- When a value may be missing, `value?.field` reads `undefined`, and some matchers pass on
  `undefined` without checking anything: `toBeUndefined`, `toBeFalsy`, `toBeNil`, and a `.not`
  matcher such as `.not.toBe('archived')`. Before one of these, narrow the value with
  `invariant(value)`, then assert on `value.field`.
- Before any other matcher, write `value?.field`. A missing value fails that matcher.
- To check that the value itself is absent, assert on the value, with no `invariant`.
- Copy a value out of a callback and assert after the call returns: an assertion in a callback that
  never runs passes.

## Matchers

Use a [jest-extended matcher](./references/matchers.md) over a hand-written check, such as
`toSatisfyAll(isOpen)`, because it prints the received value.

## Time and waiting

- Control time in the most explicit form the code allows:
  1. an argument: `expireSessions(store, { now })`;
  2. an injected clock: `ctx.clock.advance(30_000)`;
  3. fake timers, for code the repo doesn't own, restored in `onTestFinished`.
- When you can't pass the time in, assert a range around `Date.now()`, such as `toBeWithin`.
- Wait on a condition with the repo's `waitFor` helper, never a sleep. When the code has nothing to
  wait on, add a signal, such as an event.

## Boundaries

- Pick the setup by what the code under test reaches:
  - When it does no I/O, pass it plain values.
  - When it calls a remote service, answer the requests with MSW, as
    [HTTP mocking](./references/http.md) describes.
  - When it uses a database, run it against a [real database](./references/database.md).
- Never stub `fetch`, an HTTP client or the unit's own services.
- Pass every path in from the test's `mkdtemp` folder. Never steer a module through `process.cwd()`
  or a `HOME` set after startup.
- Reach a failure branch with a real failure, such as an address where nothing listens or an MSW
  handler that returns the error. Never use a spy that makes a real method reject.
- Never call `mock.module` in a test file. It leaks into every later file in the worker.

## Speed

- Keep each unit test under 5 s on CI. When one is slower, fix its cause from the
  [slow-tests table](./references/slow-tests.md). Never raise the timeout. Never move a test to a
  lane only because it is slow.
