---
name: testing
description:
  Testing rules for zgeoff repos — the three package regimes, flat behavioural tests, a setupTest
  with onTestFinished cleanup, inline data and tested factories, strict assertions and inline
  snapshots, controlled time, condition waits, real filesystems and transports, and the narrow cases
  for module mocks, plus the fix for each kind of slow test, per-run templates, and the lanes with
  their per-test timeout limits, and stored state read through the module that writes it. References
  cover real databases, HTTP mocking with MSW, observability, and Claude Code mod checks, and, in a
  repo that uses them, React and TanStack clients and native Go and NixOS conventions. Load when
  designing, writing, or reviewing tests.
metadata:
  kind: rule-set
---

# Testing

Plain `bun test` runs every test file in one process with one global object. `--parallel=N` spreads
the files over N worker processes, and it isolates each file unless the run passes `--no-isolate`.
Isolation gives each file a fresh global object and module registry, so it evaluates the preload and
every import again for each file, and `--isolate` alone does the same in one process. Isolation also
closes the servers, sockets, and subprocesses that a file leaves open, while every file still shares
the filesystem. `--parallel=1` is not plain `bun test`, because it isolates each file. Isolation can
make a suite several times slower, or cost it nothing, so a repo measures both modes before it
chooses one.

The repo's [`bunfig.toml`](../../../bunfig.toml) preload registers the matchers, the mock server
lifecycle, and every reset that returns shared state to a clean baseline after each test. Those
resets keep each file independent in either mode. Isolation hides a leak between files and never
fixes one. Each repo states its mode in its test script and in its project-testing skill, and the
pull request that sets the mode holds the measurements. The test script takes its worker count from
the shared worker helper and never passes a bare `--parallel`, which starts one worker per core, as
[Memory caps](https://github.com/zgeoff/tools/blob/main/docs/architecture/memory-caps.md#the-worker-count)
describes. Per-test resources register cleanup with `onTestFinished` where they are acquired. A test
exercises real behaviour through real code, and it reaches for a stand-in only at a boundary the
test cannot cross. When existing tests break these rules, you align them while you work on the code
they cover.

The preload starts each shared resource, such as the MSW server, in `beforeAll` and stops it in
`afterAll`, never at import, so the start and the stop pair up in every mode. Plain `bun test` runs
the preload's `beforeAll` and `afterAll` once per run, and so does `--parallel=1 --no-isolate`. An
isolated run imports the preload and runs both hooks once per file. With `--parallel=N --no-isolate`
and two or more workers, each worker imports the preload once but runs both hooks once per file. A
server started at import and closed in `afterAll` is then gone after each worker's first file. A
test process has one MSW server, and each package adds its handlers to it, as
[HTTP mocking](./references/http.md#the-server-and-its-lifecycle) describes.

A resource that each worker builds once and keeps across its files, such as a database cloned from
the per-run template, is named after the worker's process. The util opens it when it exists and
creates it when it does not, so every file in the process finds the same one in either mode, and a
module variable only caches the handle. No `afterAll` drops it in any mode, because that hook can
run after every file. [Database testing](./references/database.md#postgres-isolation) describes the
clone and the sweep that removes it.

The CI unit run passes `--randomize`, so Bun runs the files, and the tests in each file, in a random
order and prints the `--seed=<seed>` it used. A leak that a fixed order hides then fails CI. A
failure under `--randomize` is a leak between tests or files. Reproduce it by passing the printed
`--seed=<seed>`, which runs the same order again, and fix the leak at its cause, never by pinning
the order.

Never write a test only to satisfy a lint or layout rule. Change the rule's config instead, with a
one-line reason. A repo that adopts a shared lint rule, such as `zgeoff/import-zones`, never tests
that the rule or its zones fire: the rule is tested once, in its own package. Never cut a test that
checks behaviour.

## Key rules

Each line links the section that explains it.

- [Slow tests](#slow-tests): a test finishes in under 5 s; fix the cause the table names, never the
  timeout, and a lane holds only a test whose real system is the contract.
- [Regimes](#regimes): the furthest edge a package's code reaches picks its regime and the reference
  to open.
- [Principles](#principles): visible beats concise, every test stands alone, each changed behaviour
  has a test that fails without the change, and a stand-in sits only at an edge the test cannot
  cross.
- [Structure and naming](#structure-and-naming): flat `test()` calls titled "it …", one act per
  test, and no `describe`.
- [Loops](#loops): replace a loop of assertions with `test.each` or one collection matcher.
- [`setupTest`](#setuptest): one local `setupTest()` holds wiring only, and each test creates all of
  its data.
- [Cleanup](#cleanup): register `onTestFinished` right after each acquisition, with no hooks and no
  `try`/`finally`.
- [Test data](#test-data): literals stay inline, shared domain types get tested factories, and
  stand-ins hold no logic.
- [Stored state](#stored-state): a test checks database rows and stored files through the module
  that writes them, seeds them by default with inserts and factories, and has three named
  exceptions.
- [Schemas and parsers](#schemas-and-parsers): feed inline payloads, and assert the issue path or
  the parsed data.
- [Assertions](#assertions): `toStrictEqual` on the full contract, each result asserted on its own,
  and inline snapshots only for golden output.
- [Errors](#errors): each declared error gets a test, and no error is asserted inside a
  `try`/`catch`.
- [Authorisation pairs](#authorisation-pairs): an access rule lands with an allowed test and a
  refused test.
- [Narrowing and branching](./references/assertions.md#narrowing-and-branching): a test never
  branches, and it narrows before a matcher that passes on `undefined`.
- [Time and waiting](#time-and-waiting): control time by argument, then injected clock, then fake
  timers, and wait on a condition, never a sleep.
- [Boundaries](#boundaries): a stand-in replaces a boundary, never the code inside it, and a failure
  branch runs on a real failure.
- [Module mocks](#module-mocks): `mock.module` lives only in a preload, for two narrow cases.
- [Matchers](#matchers): when a jest-extended matcher checks the property, use it in place of a
  hand-written check, and give a partial-match matcher a plain object.

## References

Open a reference when the task touches its area.

- [HTTP mocking](./references/http.md): a package in the HTTP-mocked regime.
- [Database](./references/database.md): a package that owns a schema.
- [Observability](./references/observability.md): code that records metrics, spans, error reports,
  or structured logs.
- [Claude Code mod checks](./references/claude-code-mods.md): a mod's hooks, which
  `claude plugin test` runs.
- [System tests](./references/system-tests.md): end-to-end and evaluation suites, property tests,
  native timers, real transports, stateful stand-ins for a program the repo drives, and paths the
  host fixes.
- [Factories and composites](./references/factories.md): writing or changing a factory or a
  composite.
- [Shell scripts](./references/shell.md): a shell script's test, run through Bun's `$` shell, and
  its ShellCheck check.
- [Workflows](./references/workflows.md): a GitHub Actions step's logic, tested through its script,
  and the repo fact test, the one test that reads a workflow.
- [Cleanup](./references/cleanup.md): helpers that register cleanup, ordered cleanup, cleanup after
  the resets, and a test that fails only in the full run.
- [Slow tests](./references/slow-tests.md): a test over 5 s, a per-run template, or a lane.
- [Loops](./references/loops.md): a loop of assertions.
- [Test data](./references/test-data.md): a test's data and its factories.
- [Stored state](./references/stored-state.md): database rows and stored files.
- [Schemas and parsers](./references/schemas-and-parsers.md): a schema's or a parser's test.
- [Assertions](./references/assertions.md): choosing a matcher and narrowing a result.
- [Time and waiting](./references/time-and-waiting.md): time, timers, and condition waits.
- [Matchers](./references/matchers.md): the repo's custom matchers.

<!-- repo-sync needs ./references/frontend.md -->

- [Frontend](./references/frontend.md): React and TanStack clients in a web app.

<!-- repo-sync end -->

<!-- repo-sync needs ./references/go.md -->

- [Go testing](./references/go.md): Go tests.

<!-- repo-sync end -->

<!-- repo-sync needs ./references/nixos.md -->

- [NixOS testing](./references/nixos.md): Nix evaluation and VM tests.

<!-- repo-sync end -->

## Loading the skill

This skill is the shared base that repo-sync delivers from zgeoff/tools: edit it there, never in a
downstream copy. When the repo has a `project-testing` skill, load it as well. That skill adds this
repo's harnesses, regimes, and stricter rules. A project skill never relaxes a rule here; a repo
that needs an exception changes this skill.

A repo that runs the skill gate refuses an edit to a test file until the session that makes it has
loaded the skills the path needs. A subagent loads them itself, because the main session's loads do
not count for it. A compaction clears every load, so load the skills again after one. Change a gated
file with Edit, Write or MultiEdit, never with a Bash redirect, `tee`, `sed -i`, or a script. The
gate checks git status after each Bash command, and when the command changed a gated file before the
session loaded its skills, it blocks and asks for the skills and a review of the change. The block
comes after the change, so a Bash write still breaks the rule.

## Languages and runners

Apply the behavioral principles across languages. The syntax, matchers, hooks, and file conventions
in this file describe Bun tests. A reference for another runner maps them to that runner's
mechanisms, and keeps isolation, explicit scenarios, independent expectations, real boundaries, and
meaningful failures. A repo receives only the references for the runners it uses, and
[References](#references) lists them.

## Regimes

Each package falls into one regime, chosen by the furthest edge its code reaches. The regime decides
which reference to open beside this file.

| Regime        | The package                                       | The edge it tests against                           | Reference                            |
| ------------- | ------------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Pure          | A library or CLI with no service or database edge | Return values, temp directories, the spawned binary | none                                 |
| HTTP-mocked   | A client of a remote service, or a web app        | MSW handlers over an in-memory store                | [HTTP mocking](./references/http.md) |
| Real database | A service, app, or library that owns a schema     | The real engine, isolated per test                  | [database](./references/database.md) |

<!-- repo-sync needs ./references/frontend.md -->

A web app in the HTTP-mocked regime follows [frontend](./references/frontend.md) for its React and
TanStack clients.

<!-- repo-sync end -->

Code that records metrics, spans, error reports, or structured logs follows
[observability](./references/observability.md) in any regime. A Claude Code mod's hooks follow
[Claude Code mod checks](./references/claude-code-mods.md), which `claude plugin test` runs instead
of `bun test`.

## Principles

These decide a case that the rules below leave open.

- **Visible beats concise.** A reader understands a test from its body alone. Repeated literals cost
  a few lines; setup the reader cannot see costs a wrong conclusion.
- **Every test stands alone.** A test passes when run by itself, in any order, and beside every
  other test in the run.
- **Behaviour is the contract.** A test pins what the unit does for its callers. A refactor that
  keeps that behaviour, such as a renamed private helper or a reworked loop, leaves every test
  green.
- **A test fails without its change.** Each behaviour a change adds or changes gets a test that runs
  the changed path from the unit's entry and fails when the change is reverted. A test that calls
  only a helper the change left alone, checks only its own stand-in, or compares values it defined
  itself passes either way.
- **Real first, stand-ins at the edge.** Each stand-in marks a spot where the test and production
  can disagree. Use one only for what the test cannot reach, and make it faithful: real status
  codes, real payload shapes, and the production types.
- **Test utilities are code.** A helper that tests depend on lives in the repo's shared test utils
  with its own tests, because a broken helper fails silently in every suite that uses it.
- **The assertion is the test.** A test checks exactly what its assertions check. One loose
  assertion lets a broken unit pass.

## Slow tests

The fix for each kind of slow test, per-run templates and the lanes with their timeout limits are in
[Slow tests](./references/slow-tests.md).

### Where a test lives

- `<package>/src/<file>.test.ts` holds the unit suite of one source file.
- `integration/` holds one flow across several packages, in one process, with per-run fixtures and
  stand-ins. It is a place, not a lane: it runs in the unit run under every unit rule, with the 5 s
  limit.
- `e2e/` holds the tests that drive the built product from outside, through its bundle or binary,
  its CLI, HTTP, or a socket. It holds two kinds of test: the process itself (start-up, signals,
  exit codes, crash recovery), and one happy-path journey per main user flow. A flow's variants,
  such as its edge cases, error branches, and denials, run in process. A test that imports a package
  belongs in `integration/`.
- `evals/` holds the [evaluation suites](./references/system-tests.md#evaluation-suites), which
  replay a committed corpus or report through the production path. Like `integration/`, it is a
  place, not a lane: it runs in the unit run on every pull request, under every unit rule. Its
  helpers live in a package outside `evals/`, with their own unit tests.
- An app root may hold its own `integration/`, `evals/` and `e2e/`. A lane's harness lives outside
  the lane directory, in a package with its own unit tests.
- A static check of config or of generated text is a script, not a test.

To place a test, ask where its failure points. A failure that points at the wiring belongs in
`e2e/`, and one that points at the logic belongs in the unit run.

## Structure and naming

- Write each test as a top-level `test(…)` call. `describe` is banned: its scope invites shared
  hooks that couple tests, and grouping comes from the file and the title instead.
- A title starts with "it" and reads as verb, outcome, then condition:
  `it rejects a title longer than 120 characters`. It names observable behaviour, never an internal
  identifier, so `it marks the import as failed` and not `it sets status to 2`.
- When one file tests several units, such as the procedures of one router, a `#<unit>` prefix takes
  the place of "it": `#archiveNote rejects a note that is already archived`. A file that tests one
  unit uses no prefix.
- In a `bun:test` file, `zgeoff/test-shape` refuses `describe`, `it`, the four hooks, `toEqual`, and
  a title that starts with neither "it " nor a `#<unit> ` prefix.
- A test body arranges, acts, then asserts. The formatter owns spacing, including gaps between
  phases; keep its layout when it joins statements from different phases. Phase comments such as
  `// act` never appear. An ordinary test acts once: it has one act phase, which may hold several
  calls whose combined result the assertions check, such as the two runs that a determinism test
  compares. A body with two independent act-and-assert pairs holds two tests, so split it. When a
  second act depends on the first, the first act becomes arrangement, as `setupTest` describes. A
  pure function's test may collapse the three phases into one `expect` line.
- `test.each` serves a closed decision table only: rows of plain data, and a title template that
  starts with "it" and interpolates the input that varies or an accurate descriptive label for that
  input. The row supplies the actual values to the test. Any other set of cases gets a separate
  `test()` for each case.
- Tests sit beside the module they test (`parse-entry.ts` and `parse-entry.test.ts`), and a test of
  a program's entry module, such as `cli.ts`, sits beside that module too, so `src/` stays a mirror
  with one test file per module. Three directories are the exceptions: `integration/`, `evals/` and
  `e2e/` at the repo root or an app root, which [Where a test lives](#where-a-test-lives) describes.
  The repo has no other `test/`, `tests/`, or `__tests__` directory.
- A test that drives a real browser goes in `<module>.browser.test.ts` beside its module, which the
  repo runs in its own lane at `--parallel=1`, as
  [Browser suites](./references/system-tests.md#browser-suites) describes. A browser beside every
  worker, or a build per worker, holds memory the workers need.

```ts
test.each([
  ['1500ms', 1500],
  ['2s', 2000],
  ['1m', 60_000],
])('it parses %s as %d milliseconds', (input, expected) => {
  expect(parseDuration(input)).toBe(expected);
});
```

### End-to-end suites

An end-to-end suite holds tests of the process itself and one journey per main user flow, as
[Where a test lives](#where-a-test-lives) describes. It splits by user journey, one file per
journey, and a journey test may chain dependent act-and-assert phases. Its harness, resets, and
command checks follow [System tests](./references/system-tests.md#end-to-end-suites).

### Loops

How to replace a loop of assertions is in [Loops](./references/loops.md).

### Property tests

Use fast-check for generated inputs or operation sequences whose combinations matter, and keep fixed
decision tables in `test.each`. A property runner may loop, branch, and act more than once; the rest
of its rules are in [System tests](./references/system-tests.md#property-tests).

## Setup and cleanup

Process-wide setup and cleanup belong to the preload. Per-test setup belongs to one local function,
`setupTest()`, that the test calls itself. `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`
never appear in a test file.

### `setupTest`

- `setupTest()` holds only wiring: temp directories, the database, the clock, servers, clients, bare
  recorders, and the unit built through its factory. It takes no argument, or a typed config object
  that selects which dependencies to wire and carries no value that a test's outcome depends on. It
  returns named properties and has no `if`.
- `setupTest()` wires dependencies and creates no data. Data is any row, file, store entry, or
  starting value that the code under test reads. Each test creates all of its data in its arrange
  phase, even when every test in the file needs the same data. A wired clock starts at a fixed
  default; a test that reads the time sets the clock in its arrange phase. A temp directory, a
  schema, and a handle are wiring.
- A shared helper whose arguments carry the scenario, such as `startTestSite(pages)`, is called in
  the test body with those arguments written there. `setupTest()` wraps only a helper that takes no
  scenario.
- Return runtime handles and generated infrastructure paths from `setupTest()` as named properties,
  such as a database handle, a temporary directory, or a VM's system path. They remain runtime
  wiring when a test compares them.
- An earlier act that the test's one act depends on, such as starting the session that the test
  attaches to or saving the note that it archives, stays in the arrange phase of the test body, with
  no assertion, because a separate test covers that act. A recovery test is the exception: it
  asserts each fault it injected, as [Assertions](#assertions) describes.
- A test file declares one function, `setupTest()`, and nothing else, and `zgeoff/setup-test-only`
  fails any other module-level declaration. A helper the tests want goes one of three ways: inline
  it where it is used, swap it for a registered matcher, or move it to the shared test utils with
  tests of its own. A file with nothing to wire has no `setupTest()`. One exception: a
  collection-time skip gate may keep its awaited probe, and named gates derived from it, at module
  level. Only `skipIf` reads them, each repeated condition is named once, and a comment gives the
  reason: Bun's `skipIf` takes a boolean and has no in-body skip.
- `setupTest()` may return a closure that only calls production helpers on the runtime it built,
  such as `createImpDir(name)`. A closure with a branch, a loop, or state of its own is a helper,
  and it moves to the shared test utils.
- Each test file keeps its own `setupTest()`. A shared one gathers a flag for every suite that uses
  it.

In this made-up example, `setupTest()` returns only the wiring, and the test inserts the user in its
arrange phase:

```ts
async function setupTest() {
  const db = await createTestDatabase();
  const client = createNotesClient({ db });

  return { db, client };
}

test('it lists the notes of a user with none as empty', async () => {
  const ctx = await setupTest();
  const user = await ctx.db
    .insertInto('users')
    .values({ name: 'ada' })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(await ctx.client.listNotes({ userID: user.id })).toStrictEqual([]);
});
```

In the made-up counter-example, `setupTest()` inserts the user row and returns it, so it creates
data:

```ts
async function setupTest() {
  const db = await createTestDatabase();
  const client = createNotesClient({ db });
  const user = await db
    .insertInto('users')
    .values({ name: 'ada' })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { db, client, user };
}
```

Repeated arrange lines stay inline, or move to a tested shared util that the test calls with its
arguments, such as `createTestUser(ctx, { name: 'ada' })`.

Register cleanup with `onTestFinished` immediately after each successful resource acquisition, so a
later setup step or assertion that throws still releases the resource. `setupTest()` returns named
properties; it adds no disposal symbol solely to forward cleanup. The test holds the result in a
plain `const`.

```ts
async function setupTest() {
  const dir = await mkdtemp(join(tmpdir(), 'notes-'));

  onTestFinished(() => rm(dir, { recursive: true, force: true }));

  return { dir };
}

test('it reads an empty file as no entries', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.dir, 'entries.txt'), '');

  expect(await readEntries(ctx.dir)).toStrictEqual([]);
});
```

Synchronous acquisition and cleanup keep `setupTest()` synchronous. An async cleanup callback does
not make setup async. Hold the result in one binding and read its members; never destructure it. The
binding names are fixed: `ctx` for `setupTest()`, `hook` for `renderHook(…)`, and `rendered` for
`render(…)`.

### Cleanup

Each kind of state has one cleanup tool.

| State                                                   | Cleanup                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| A resource that `setupTest()` or the test body acquires | `onTestFinished(…)` immediately after acquisition |
| Process state the test body changes                     | `onTestFinished(…)` immediately after the change  |
| State that a preload reset covers                       | Nothing                                           |

`try`/`finally` never appears in a test. `onTestFinished` runs on failure as well, keeps teardown
beside the acquisition, and needs no `?.` guard for a resource the test never reached. A helper that
registers cleanup for its callers, resources that close in order, and cleanup that runs after the
preload's resets follow [Cleanup](./references/cleanup.md).

A resource that a test leaves behind costs memory as well as isolation: `/tmp` and a database's data
on tmpfs sit in RAM until something removes them. A run that a kill stops runs no cleanup at all,
and [Leftovers of a killed run](./references/cleanup.md#leftovers-of-a-killed-run) covers what it
leaves. Each run keeps within the
[memory budgets](https://github.com/zgeoff/tools/blob/main/docs/guides/memory-budgets.md).

A test overrides an environment variable through the repo's env util, and the preload restores every
override after each test. A test never assigns `process.env` directly. A test never relies on a
unique key to avoid another test's rows: isolation comes from resets, not from luck.

### A test that fails only in the full run

A test that passes alone and fails beside others has found a cleanup gap.
[Cleanup](./references/cleanup.md#a-test-that-fails-only-in-the-full-run) holds the steps that find
the gap and close it.

## Test data

Where test data lives, and when it gets a tested factory, is in
[Test data](./references/test-data.md).

## Stored state

How a test seeds and checks database rows and stored files is in
[Stored state](./references/stored-state.md).

## Schemas and parsers

How to test a schema or a parser is in [Schemas and parsers](./references/schemas-and-parsers.md).

## Assertions

Which matcher fits each result, and how to assert it, is in
[Assertions](./references/assertions.md).

### Errors

- Assert an error at the strictness its contract needs: `toThrow()` when only the throw matters,
  `toThrowWithMessage(Error, /…/)` when the message is contract, and `toMatchObject({ code })` when
  the error carries a typed code. An inline snapshot pins the whole error when its full text is a
  golden value.
- Each error that a unit declares has its own test. A declared error is one that real input or a
  real failure can raise.
- A throw that cannot occur in production declares no error and has no test. When one dependency's
  own contract rules the state out, delete the branch, such as `if (!result.success)` after
  `Bun.build()`, which throws on failure. In every other case, write `invariant()` from
  `tiny-invariant`. A failure that can occur in production but that a test cannot cause follows
  [Infrastructure failures](#infrastructure-failures).
- A `try`/`catch` never asserts an error: when the call does not throw, the assertion never runs.
- `bun-types` declares `.rejects` and `.resolves` as synchronous matchers, and Bun settles the
  promise inside the matcher. Write these chains without `await`. `toResolve()` and `toReject()`
  return a promise: always `await` them.

```ts
test('it rejects a note owned by another user', async () => {
  const ctx = await setupTest();

  const note = await saveNote(ctx.db, { ownerID: 'user_a', title: 'private' });

  expect(readNote(ctx.db, { noteID: note.id, userID: 'user_b' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
```

### Authorisation pairs

An access rule lands with two tests: the allowed caller succeeds, and the other caller is refused.
The refused case names the other caller in its title, such as
`it rejects a note owned by another user`. A read path that hides a record instead of refusing
asserts the hidden result, such as `toBeNull()`.

## Time and waiting

How a test controls time and waits on a condition is in
[Time and waiting](./references/time-and-waiting.md).

## Boundaries

Stand-ins replace a boundary, never the code inside it. A test never stubs `fetch`, an HTTP client,
or a method of the unit's own services: the path from the call to the boundary runs for real,
including serialisation and error handling.

A stand-in passed through the unit's own parameters replaces a boundary, and the stand-in rules in
[Test data](#test-data) decide where it lives. Replacing a method of a real object that the unit
builds or imports is a spy, which [Infrastructure failures](#infrastructure-failures) bans.

| Boundary                                        | The test uses                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pure computation                                | Return values, with no stand-in                                                                   |
| A CLI                                           | The real binary, spawned end to end                                                               |
| A shell script                                  | The real script, run through Bun's `$`, as [shell scripts](./references/shell.md) describes       |
| The filesystem                                  | A real `mkdtemp` tree per test                                                                    |
| A database                                      | The real engine, isolated per test, as [database](./references/database.md) describes             |
| A remote HTTP or RPC service                    | MSW handlers, as [HTTP mocking](./references/http.md) describes                                   |
| A service with a cheap container                | The real service in a container                                                                   |
| An SDK with a command layer                     | A stand-in at the command layer                                                                   |
| A queue or pub/sub without a faithful emulator  | A wrapper with queryable state, as [HTTP mocking](./references/http.md) describes                 |
| A program the repo drives over its own protocol | A stateful stand-in, as [System tests](./references/system-tests.md#stateful-stand-ins) describes |

A module that is hard to test without a stand-in takes its I/O from its caller: test the pure core
with values, and test the I/O edge against the real boundary.

### Real applications and transport

A client of a service that the same repo holds, and a network edge that request interception cannot
reach, each follow [System tests](./references/system-tests.md#real-applications-and-transport).

<!-- repo-sync needs ./references/frontend.md -->

Frontend component tests keep the MSW boundary in [frontend testing](./references/frontend.md), with
the real SDK and RPC serialization.

<!-- repo-sync end -->

### Filesystem

A real temp tree costs about 1 to 2 ms per test for a handful of small files, and more as the tree
grows. A test pays that for real behaviour: `fs.watch`, permissions, symlinks, `Bun.file`, and
`Bun.write`, which an in-memory filesystem fakes or misses. Take every path from the temp root and
pass it into the module. Never steer a module through `process.cwd()` or through a `HOME` value set
after startup, because Bun reads some of those once at startup.

### Program-fixed paths and global resources

A path that a kernel or program contract fixes, and a machine-global resource, need checked
ownership and cleanup that releases only what the run acquired, as
[System tests](./references/system-tests.md#program-fixed-paths-and-global-resources) describes.

### Infrastructure failures

A failure branch runs on a real failure:

- A database or socket that is down: point the real driver at an address where nothing listens, and
  destroy the handle in `onTestFinished`.
- A downstream service that errors: a per-test MSW handler that throws or returns the error status.
- One statement that fails in the middle of a flow: real state that makes it fail, such as a
  conflicting row for a constraint, or a held lock with a short `lock_timeout`.

A spy that makes one method of a real object reject never appears. A branch that neither a dead
transport nor real state can reach shows a missing injection point: put that dependency behind an
injected boundary.

### Module mocks

`mock.module` never appears in a test file. A run without `--isolate` keeps one module registry per
process, so a module mock in one file applies to every file that loads after it. Two kinds of module
mock are legal, and each lives in a preload module named `register-<module>-mock.ts`:

- **A stand-in for what the test runtime cannot host**, such as a WebGL scene, a `SharedWorker`, or
  a framework's ambient server context. It reads from a stub store, and one exported setter is the
  only way a test changes that store.
- **A wrapper that a library documents for testing**, which keeps the real behaviour and adds one
  hook, such as the store reset that `@zgeoff/bun-test-react/zustand` installs.

Any other module mock is banned, auto-mocking included. A module mocked because of what it imports
shows a defect in the import graph: fix the import graph instead.

## Matchers

The repo's matchers, and when to add one, are in [Matchers](./references/matchers.md).
