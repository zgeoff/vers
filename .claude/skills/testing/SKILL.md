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
- [Narrowing and branching](#narrowing-and-branching): a test never branches, and it narrows before
  a matcher that passes on `undefined`.
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

A test finishes in under 5 s on CI. A slow test costs every later run its full time, and a raised
timeout or a sleep hides that cost without removing it. `zgeoff/max-test-timeout` refuses a timeout
above the limit of the file's lane, and `zgeoff/no-test-sleep` refuses a fixed sleep. When a test is
slow, find its cause in this table and make the change it names. Never raise the timeout first.

| The test                                                                                    | The cause                           | The fix                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| starts the app, a server or a CLI to call it                                                | a real process start                | Call the code in the test process: its handler, an in-memory RPC link, or an injected transport. Start a real process only in `e2e/`, from the bundle built once per run, for the jobs [Where a test lives](#where-a-test-lives) names.                                           |
| waits for a deadline, an idle limit or a retry delay                                        | a real timer or deadline            | Make the deadline an option of the code that owns it, pass a short one, and wait on the event that the deadline causes. A runtime or kernel timer gets the shortest faithful value, as [Native timers](./references/system-tests.md#native-timers-and-scenario-delays) describes. |
| sleeps to let something settle                                                              | no signal to wait on                | Wait on a condition with the repo's `waitFor` helper. When the code offers nothing to wait on, add an event, a log marker or a state flag.                                                                                                                                        |
| proves that something does not happen                                                       | it waits out a timeout              | Wait for a later event that shows the thing did not happen.                                                                                                                                                                                                                       |
| migrates a database or builds a bundle                                                      | a shared fixture build              | Use a [per-run template](#per-run-templates), built once per run and copied per test.                                                                                                                                                                                             |
| drives a program the repo starts, such as a guest, a worker or a VM manager                 | a real process start                | Use the program's stateful stand-in from the repo's project-testing skill. When none exists, write one, as [Stateful stand-ins](./references/system-tests.md#stateful-stand-ins) describes.                                                                                       |
| needs the real system, and the real system is the contract                                  | a VM, the kernel, a browser, an API | Put it in a [lane](#lanes). Its directory or file suffix names the lane.                                                                                                                                                                                                          |
| runs a linter or checker binary over text the code builds, such as a generated shell script | a real process start                | It is not a test. Export the text and check it in a static check script that runs in the CI static job and before a push.                                                                                                                                                         |

The limits are CI rules, because a host that swaps or shares its cores runs the same test slower. A
test script and the repo's Bun config never raise a lane's default timeout above its limit, and one
test that cannot fit carries the disable comment that
[A test over its limit](#a-test-over-its-limit) describes. The pre-push hook runs only the unit
tests beside the files a branch changes, and every lane runs only in CI, as the
[pre-push baseline](https://github.com/zgeoff/tools/blob/main/docs/architecture/pre-push-baseline.md#the-related-tests)
describes.

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

### Per-run fixtures and lanes

A real system that starts fast and isolates per test is a per-run fixture in the unit run, not a
lane. An in-memory store, a database template copied per test, and a stand-in daemon that starts in
milliseconds are per-run fixtures. A lane exists only for a real system that the unit run cannot
host, such as a VM, the kernel or root, a browser, a container image, the Agent SDK subprocess, or a
live API, or for a test of the process itself.

### Per-run templates

A fixture that costs more to build than a test costs to run, such as a migrated database or a built
bundle, is a per-run template. The first worker to need it builds it under a file lock, and each
test copies it or reads it. A per-process memo is wrong: an isolated file evaluates it again, and
the workers race on one output folder.

- The template's name holds a hash of its inputs, such as the migration files, so a changed input
  builds a new template and an unchanged one reuses the last.
- It lives in a git-ignored cache folder inside the repo, never in `/tmp`, because `/tmp` is tmpfs
  on many hosts and holds every file in RAM.
- The sweep at the start of each run removes the per-run folders and clones that older runs left and
  the templates of old hashes. It never removes the template for the current hash, which a
  concurrent run may be copying.

[Database testing](./references/database.md) describes the template for each engine.

### Lanes

A lane runs the tests that need one real system. Each lane has its own `test:<lane>` script and a
per-test limit, which the script's `--timeout` sets and `zgeoff/max-test-timeout` checks in each
lane file. The unit run and the pre-push hook leave the lane files out by pattern. The
[ci-design](../ci-design/SKILL.md) skill decides where CI runs each lane.

| Lane      | Where                                  | Limit | The real system                                                              |
| --------- | -------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| unit      | every other test file                  | 5 s   | none: code in process, per-run fixtures, and stand-ins                       |
| e2e       | `e2e/` at the repo root or an app root | 15 s  | the built product, driven from outside                                       |
| browser   | `<name>.browser.test.ts`               | 10 s  | a real browser                                                               |
| docker    | `<name>.docker.test.ts`                | 15 s  | a container engine                                                           |
| host      | `<name>.host.test.ts`                  | 15 s  | the host kernel, root, or the network stack                                  |
| agent-sdk | `<name>.agent-sdk.test.ts`             | 5 s   | the Claude Agent SDK subprocess against a scripted model, never the live API |
| model-api | `<name>.model-api.test.ts`             | 120 s | a live model API                                                             |

- The `model-api` lane runs nightly, on dispatch, and on a pull request that bumps the Agent SDK
  when the pull request carries the opt-in label, never on every pull request. A test that calls a
  live model takes the suffix wherever it lives, in `evals/` too.
- A test that calls a live API other than a model gets its own project lane, with a suffix that
  names that API.
- A suffix names one real system, never a speed. A repo prefers a specific suffix to the generic
  `.host`, such as a made-up `.kvm` for a test that boots a VM.
- A repo adds a project lane only for a real system that this section allows. Its project-testing
  skill lists the lane with its real system and its limit. A repo that uses
  [`@zgeoff/rig`](https://github.com/zgeoff/tools/blob/main/docs/architecture/rig.md#one-source-for-the-limits)
  declares the lane and its limit in its rig config, which the lint rules read. A repo that does not
  declares them in the `lanes` option of `zgeoff/max-test-timeout` and of
  `zgeoff/test-beside-module` in its root oxlint config. The pull request that adds the lane holds
  its measured test times.
- A test that is slow only because of a runtime timer stays in the unit run, with the disable
  comment that [A test over its limit](#a-test-over-its-limit) describes.
- A lane holds no test that is only slow. Before a test moves to a lane, check that no other row of
  the cause table fits it.

A Rust crate runs the same lanes through cargo-nextest, as
[Rust lanes](./references/system-tests.md#rust-lanes) describes.

### A test over its limit

A test whose cause the [Slow tests](#slow-tests) table can fix gets that fix in the pull request
that meets it, never a ticket. A test that still cannot finish within its lane's limit carries a
disable comment that gives the measured time and one of two reasons:

- the ticket that tracks the fix, when the fix cannot land in this pull request, such as a fix in
  another repo;
- `floor:` and the measured evidence that the time cannot move, such as
  `48 s on CI; floor: two VM boots plus a restic restore`.

The ticket form, in this made-up example:

```ts
test(
  'it restores a volume from its oldest snapshot',
  async () => {
    // …
  },
  // oxlint-disable-next-line zgeoff/max-test-timeout -- 48 s on CI, OPS-212
  { timeout: 60_000 },
);
```

The rule reports the timeout value, so the comment sits on the line before the options object. The
options object follows the callback, because Bun's types accept no other order. The formatter puts
each argument on its own line, so the comment stays next to the object.

The limit never rises to cover one test. `zgeoff/test-timeout-exception-ticket` fails a disable of
`zgeoff/max-test-timeout` whose reason after `--` holds neither a ticket nor `floor:` with text, in
any of its forms. The test timeout check fails an oxlint config that turns either rule off or down
to a warning, unless a comment on that setting holds a ticket or a `floor:`.

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

A loop that runs an assertion once per input hides which input failed, and its first failure stops
the rest. Replace it with `test.each`, or write each case as its own test. A loop of `expect` calls
over the items of one result becomes one collection matcher, which reports the whole collection on
failure:

```ts
expect(listOpenNotes(store)).toSatisfyAll((note: Note) => note.archivedAt === null);
```

Two loops that check a set the module owns stay legal:

- A completeness loop that walks a module's own registry, such as checking that every exported
  renderer has a preview.
- A conformance loop that drives each generated case through
  `await expect(conformanceCase.run(app)).toResolve()`.

Neither loop may compute its expectation with the same transformation it checks. A loop that only
arranges, such as inserting 51 rows to cross a page limit, holds no assertion and stays legal. When
the order of the rows does not matter, insert them with
`await Promise.all(Array.from({ length: 51 }, …))`. When it does, insert them one at a time in the
loop.

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

- Plain inputs stay inline at the call site: arguments, options bags, config values. Write the
  literal again in the next test. A module-level fixture, a baseline object shared between tests, or
  a constant that only names a literal (`const EMPTY = ''`) never appears in a test file.
- A domain type that crosses a module boundary gets a tested factory in the shared test utils as
  soon as a test needs one, and a domain concept built from several records gets a composite. A type
  that another package owns, such as an SDK result, crosses a boundary on its first use. A type
  private to the module under test stays an inline literal.
  [Factories and composites](./references/factories.md) holds how to name and write a factory or a
  composite.
- A stand-in's data stays inline in the test: a fixed answer, a recorder (`mock()`), including one
  that parses the input it records, a no-op (`() => {}`), an answer table read by one key, or a list
  of scripted answers that the test passes to the tested answer-queue util. Any other code in a
  stand-in is logic, such as consuming answers in order, counting calls, keeping state, branching,
  waiting, or deriving a value from an argument. It moves to a tested util in the shared test utils,
  and so does a gate, delay, or counter wrapped around a tested stand-in. The test passes its
  answers to that util inline.
- A stand-in util lives in the shared test utils under a name for what it impersonates. Its prefix
  follows the repo's function-naming table. A stand-in that starts something long-running, such as a
  stub server, is `start-stub-<thing>.ts`. A stand-in that creates a resource, such as a stub
  repository on disk, is `create-stub-<thing>.ts`. Every other stand-in is `build-stub-<thing>.ts`.
  It has its own tests, which pin the assumptions it makes about the real thing. An executable
  stand-in script uses `run-stub-<thing>.ts`; an imported helper that starts it keeps
  `start-stub-<thing>.ts`.
- Never add a test whose only purpose is to check that the mocking library records calls. A no-op
  executable placeholder stays inline through the shared file helper when the test needs only an
  executable. Extract a dedicated stand-in when the script models arguments, output, or failures.
- A chain of `mockReturnValueOnce` or `mockResolvedValueOnce` calls never appears: a call past the
  last answer returns the default without failing, where the answer-queue util throws.

## Stored state

Check stored state through its owner. Stored state means database rows and files on disk. The owner
is the module whose code writes them.

- The owner's own tests read its rows and files directly.
- Every other test reads them only through the owner's code: a read function for rows, a path helper
  for files. It never writes its own query and never builds a stored path by hand.
- If the unit under test already returns the fact, check its result. Use the owner's code only when
  the result does not hold the fact.
- If the owner has no read function for the fact, add one to the owner, with its own test.
- A query that only sets up a failure, such as a trigger that makes a write fail, is setup, not a
  check. It stays.

`src/notes/store/` writes the `notes` table and the attachment files, so it owns both. A handler
test outside the store checks the result of an archive.

```ts
// before: the test writes its own query and builds the path by hand
const row = await ctx.db
  .selectFrom('notes')
  .select('archived_at')
  .where('id', '=', note.id)
  .executeTakeFirstOrThrow();

expect(row.archived_at).toBeValidDate();
expect(existsSync(join(ctx.dataDir, 'archive', note.id, 'list.txt'))).toBe(true);

// after: the test reads through the store's read function and path helper
const archived = await readNote(ctx.db, note.id);

expect(archived?.archivedAt).toBeValidDate();
expect(existsSync(buildArchivePath(ctx.dataDir, note.id, 'list.txt'))).toBe(true);
```

The store's own test, `src/notes/store/read-note.test.ts`, still inserts and queries `notes`
directly, because the table is what it checks.

### Seeding stored state

A test seeds stored state with direct inserts and [factories](./references/factories.md) by default.
A seeding helper is a [composite](./references/factories.md#composites): it lives in the repo's
shared test utils with its own tests, takes a name the system already uses, and writes the whole
effect behind that name, such as the row and the files of one image.

A store with no service layer seeds through its own write functions, never through raw SQL. A direct
write that no write function can make stays, with the `//` comment that names the case, as
[Persisted test data](./references/database.md#persisted-test-data) asks.

A repo's `project-testing` skill lists the concepts that seed only through a composite, and an agent
follows that list. The repo's maintainer designs the first seeding pattern in each repo before
anyone builds one. An agent can then add composites that follow that pattern.

### Exceptions to checking through the owner

Three kinds of test outside the owner read and write stored state directly, and no others:

- A migration test reads and writes tables directly.
- The own test of a composite or a seeding helper checks the rows and files that it writes.
- A test of code whose product is SQL or storage, such as a database dialect or a database tool,
  uses tables as its test input.

Tests under `integration/` and `e2e/` get no exception. A case off this list changes this shared
skill, never a project skill. A project skill tightens the rule in two ways only: the seeding list,
and a named owner for a table that several modules write. It never adds an exception.

## Schemas and parsers

- Feed a parser or a validator inline literal payloads: ones it accepts and ones it rejects. A
  factory produces values built to pass the schema, so its output cannot show the schema rejecting
  anything.
- A rejection payload repeats the complete valid literal and alters a single field, so the reader
  sees which field causes the rejection.
- A rejection test asserts the path of the reported issue, in one shape, because a payload can be
  invalid for many reasons and `success: false` passes for all of them:

  ```ts
  expect(result.error?.issues).toPartiallyContain({ path: ['title'] });
  ```

  Pass the expected partial object directly, never wrapped in `expect.objectContaining`, which
  `toPartiallyContain` does not check (see [Matchers](#matchers)). Never read `issues[0]`, which
  ties the test to issue order.

- An acceptance test asserts `result.data`. For a schema that passes values through, assert
  `toStrictEqual(payload)`. For one that transforms, assert the transformed value. A bare
  `success: true` passes for a schema that strips or coerces a field wrongly.

## Assertions

- Use `toStrictEqual` when the test determines every field of the expected value: the full shape is
  the contract. When the value carries fields that the test does not determine, such as faker
  defaults, timestamps, or generated ids, use asymmetric matchers inside `toStrictEqual`, or
  `toMatchObject`. Choosing a partial match because the full literal is long is a defect. `toEqual`
  never appears.
- Assert each result on its own. Never assemble unrelated results or observations into an object
  only to put them under one `toStrictEqual`. A normalized projection of one result, such as a
  command's exit code, stdout, and stderr, stays together. A later request's status is a separate
  assertion. Independently meaningful scalar checks use separate `toBe` calls.
- Derive an expected value from the contract, independently of the unit's own calculation. For a
  filesystem path, use a known package or fixture root plus the explicit expected location, rather
  than repeating the unit's relative path expression. Keep a behaviour check where it proves the
  derived value works.
- A recovery test injects one or more faults and then acts to recover. The recovery is its one act,
  and each faulted call is arrangement. During arrangement, capture the earlier state and each
  faulted call's rejection as values, the rejection with
  `.then(() => null, (error: unknown) => error)`. Assert every captured value at the end beside the
  final state, with a separate assertion for each.
- After a mutation, one `toBe` on the field that changed is enough.
- Snapshots are inline only. `toMatchInlineSnapshot` pins a golden value: deterministic machine
  output that no person derives by reading the code, such as a generated SQL string or a rendered
  report. A value a person wrote by hand, such as a spec test vector, keeps an explicit matcher,
  because a snapshot of it would bless whatever the code produced. File snapshots and component
  snapshots never appear, and `zgeoff/no-file-snapshot` reports a file snapshot.
- A deterministic pipeline's suite opens with two tests. A frozen-golden test feeds one hand-written
  literal input and pins the full output inline. A determinism test asserts that the same input
  gives equal outputs: `expect(run(input)).toStrictEqual(run(input))`. The golden input is never a
  factory call, because regenerating snapshots must never change the input.
- When the repo commits a file that it generates, such as an OpenAPI document, the frozen-golden
  test compares the regenerated output with that committed file instead of an inline snapshot. That
  file is a product of the repo, not a file snapshot.
- A stand-in's derived values, such as a fake hash or a fake signature, are not contract. Assert
  their properties: their shape, that the same input gives the same output, and that different
  inputs give different outputs.
- A sweep that deletes resources has a test that names what it never touches, such as
  `it never removes another owner's files`.

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

### Narrowing and branching

An ordinary test body never branches. Each path through the unit gets its own test. Generated
operation dispatch follows [Property tests](#property-tests).

Narrow a value that may be missing with `invariant(value)` or an explicit `throw` on the line before
the assertion. Optional chaining inside `expect` is safe when the matcher fails on `undefined`,
because a missing value then fails loudly:

```ts
expect(result.data?.title).toBe('groceries');
```

Four matchers pass on `undefined`: a `.not` matcher, `toBeUndefined`, `toBeFalsy`, and `toBeNil`.
With those, `?.` or `??` turns a missing value into a pass, so narrow first:

```ts
invariant(result.data);
expect(result.data.error).toBeUndefined();
```

When you are unsure which kind a matcher is, narrow.

An assertion inside an ordinary callback passes when the callback never runs. Copy the value out of
the callback into a variable, then assert on it once the call returns. Property-runner assertions
follow [Property tests](#property-tests).

## Time and waiting

Control time in the most explicit form the code allows:

1. **A time argument.** Code that advances through time takes the duration or the timestamp as a
   parameter: `scheduler.advance(30_000)`.
2. **An injected clock.** Code with its own loop or timers takes a `now` function or a clock object,
   and the test steps it.
3. **Fake timers.** Code the repo does not own, such as a third-party library, gets
   `setSystemTime()` and fake timers. The test restores them in `onTestFinished`.

A Claude Code mod reads the wall clock and never the host's clock, for the reason in
[Claude Code mod checks](./references/claude-code-mods.md#time).

A value that depends on the wall clock is built relative to `Date.now()`
(`expiresAt: new Date(Date.now() - 1000)`) and asserted with range matchers such as `toBeAfter` and
`toBeWithin`, never with an exact timestamp.

A test waits on a condition with a polling `waitFor`, never with a sleep. A sleep makes the suite
slower by its full length on every run, and it still fails on a slow machine. When the code offers
nothing observable to wait on, the code lacks a signal: add one, such as an event, a log marker, or
a state flag, and wait on that.

### Native timers and scenario delays

A native runtime or kernel timer, a timer a third-party library owns, a deadline the repo's code
runs in a spawned process, and a deliberate workload or fault delay each follow
[System tests](./references/system-tests.md#native-timers-and-scenario-delays).

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

The `@zgeoff/bun-test-extended` preload registers the jest-extended matchers, and a package's
`augment-bun-test.ts` import gives `tsc` their types. Typecheck fails on a matcher name that does
not exist. When a matcher in this table checks the property a test asserts, use it in place of a
hand-written check such as `expect(items.every(isOpen)).toBe(true)`, because the matcher reports the
received value on failure and the hand-written check reports only `false`:

| Value             | Matchers                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Array             | `toIncludeAllMembers`, `toIncludeSameMembers`, `toIncludeAllPartialMembers`, `toPartiallyContain`, `toSatisfyAll` |
| Object            | `toContainEntry`, `toContainEntries`, `toContainAllKeys`, `toBeFrozen`                                            |
| String            | `toStartWith`, `toEndWith`, `toInclude`, `toEqualCaseInsensitive`, `toEqualIgnoringWhitespace`                    |
| Any value         | `toBeNil`, `toBeOneOf`, `toSatisfy`, `toBeWithin`, `toBeEmpty`                                                    |
| Date              | `toBeAfter`, `toBeBefore`, `toBeBetween`, `toBeValidDate`                                                         |
| Mock              | `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenCalledBefore`, `toHaveBeenCalledAfter`      |
| Error and promise | `toThrowWithMessage`, `toResolve`, `toReject`                                                                     |

Each matcher also works asymmetrically inside `toStrictEqual` and `toMatchObject`, as in
`status: expect.toBeOneOf(['open', 'held'])`. Upstream leaves `expect.pass` and `expect.fail`
unimplemented, so the types leave them out.

`toPartiallyContain` and `toIncludeAllPartialMembers` take plain objects, such as
`toPartiallyContain({ path: ['title'] })`, and never a bare asymmetric matcher as an element. They
compare the expected element's own fields with each received element, and a Bun matcher such as
`expect.toStartWith('zzz')` or `expect.objectContaining({ id: 2 })` has no own fields, so any
non-empty array passes. A matcher inside a field is checked, as in
`toPartiallyContain({ name: expect.toStartWith('a') })`. To find an element by a matcher, use
`toContainEqual`, which applies the matcher to each element:
`expect(names).toContainEqual(expect.toStartWith('a'))`.
