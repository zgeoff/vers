---
name: testing
description:
  Testing rules for zgeoff repos — the three package regimes, flat behavioural tests, a setupTest
  with onTestFinished cleanup, inline data and tested factories, strict assertions and inline
  snapshots, controlled time, condition waits, real filesystems and transports, and the narrow cases
  for module mocks. References cover real databases, React and TanStack clients, HTTP mocking with
  MSW, observability, and native Go and NixOS conventions. Load when designing, writing, or
  reviewing tests.
---

# Testing

`bun test` loads every test file into one process, so state that one file leaves behind is state the
next file sees. The repo's `bunfig.toml` preload owns that process: it registers the matchers, the
mock server lifecycle, and every reset that returns shared state to a clean baseline after each
test. Per-test resources register cleanup with `onTestFinished` where they are acquired. A test
exercises real behaviour through real code, and it reaches for a stand-in only at a boundary the
test cannot cross. When existing tests break these rules, you align them while you work on the code
they cover.

This skill is the shared base that repo-sync delivers from zgeoff/tools: edit it there, never in a
downstream copy. When the repo has a `project-testing` skill, load it as well. That skill adds this
repo's harnesses, regimes, and stricter rules. A project skill never relaxes a rule here; a repo
that needs an exception changes this skill.

## Languages and runners

Apply the behavioral principles across languages. The syntax, matchers, hooks, and file conventions
in this file describe Bun tests. For Go, read [Go testing](./references/go.md); for Nix evaluation
and VM tests, read [NixOS testing](./references/nixos.md). Those mappings preserve isolation,
explicit scenarios, independent expectations, real boundaries, and meaningful failures through the
native runner's mechanisms.

## Regimes

Each package falls into one regime, chosen by the furthest edge its code reaches. The regime decides
which reference to open beside this file.

| Regime        | The package                                       | The edge it tests against                           | Reference                                                                  |
| ------------- | ------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Pure          | A library or CLI with no service or database edge | Return values, temp directories, the spawned binary | none                                                                       |
| HTTP-mocked   | A client of a remote service, or a web app        | MSW handlers over an in-memory store                | [HTTP mocking](./references/http.md), [frontend](./references/frontend.md) |
| Real database | A service, app, or library that owns a schema     | The real engine, isolated per test                  | [database](./references/database.md)                                       |

Code that records metrics, spans, error reports, or structured logs follows
[observability](./references/observability.md) in any regime.

## Principles

These decide a case that the rules below leave open.

- **Visible beats concise.** A reader understands a test from its body alone. Repeated literals cost
  a few lines; setup the reader cannot see costs a wrong conclusion.
- **Every test stands alone.** A test passes when run by itself, in any order, and beside every
  other test in the process.
- **Behaviour is the contract.** A test pins what the unit does for its callers. A refactor that
  keeps that behaviour, such as a renamed private helper or a reworked loop, leaves every test
  green.
- **Real first, stand-ins at the edge.** Each stand-in marks a spot where the test and production
  can disagree. Use one only for what the test cannot reach, and make it faithful: real status
  codes, real payload shapes, and the production types.
- **Test utilities are code.** A helper that tests depend on lives in the repo's shared test utils
  with its own tests, because a broken helper fails silently in every suite that uses it.
- **The assertion is the test.** A test checks exactly what its assertions check. One loose
  assertion lets a broken unit pass.

## Structure and naming

- Write each test as a top-level `test(…)` call. `describe` is banned: its scope invites shared
  hooks that couple tests, and grouping comes from the file and the title instead.
- A title starts with "it" and reads as verb, outcome, then condition:
  `it rejects a title longer than 120 characters`. It names observable behaviour, never an internal
  identifier, so `it marks the import as failed` and not `it sets status to 2`.
- When one file tests several units, such as the procedures of one router, a `#<unit>` prefix takes
  the place of "it": `#archiveNote rejects a note that is already archived`. A file that tests one
  unit uses no prefix.
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
  a program's entry module, such as `cli.ts`, sits beside that module too. The one exception is
  `e2e/` at the repo root, which holds the end-to-end suites that run the whole program. The repo
  has no other `test/`, `tests/`, or `__tests__` directory.

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

An end-to-end suite splits by user journey, one file per journey: `e2e/tui-spawn.test.ts` beside
`e2e/tui-attach.test.ts`. A journey test may chain dependent act-and-assert phases, because each
step of the journey needs the state that the step before it left. Ordinary tests outside `e2e/` act
once. Generated sequences follow [Property tests](#property-tests).

An outer harness may reuse expensive hosts, services, and immutable fixture inputs across journeys.
Each journey keeps its own file, setup, scenario, and cleanup. Reset shared infrastructure to a
clean baseline before each journey; test that the reset removes dirty state, including after failure
or interruption. Recreate the environment when a reset cannot restore the baseline. The harness owns
infrastructure startup and shutdown; test files keep the hook rules in
[Setup and cleanup](#setup-and-cleanup).

Keep command construction importable. Test argument and flag-position cases through the real parser
in module tests; keep binary journeys that check the assembled program.

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
arranges, such as inserting 51 rows to cross a page limit, holds no assertion and stays legal.
Prefer `await Promise.all(Array.from({ length: 51 }, …))` when the order of the rows does not
matter.

### Property tests

Use fast-check for generated inputs or operation sequences whose combinations matter. Keep fixed
decision tables in `test.each`. A property runner may dispatch generated operations, branch on
expected outcomes, and check invariants after each operation. These permissions apply inside the
property runner and its operation interpreter; ordinary tests keep their loop, branching, and
single-act rules. Await an async `fc.assert` so a failed property fails the enclosing test.

- Check relevant transitions, not only the final state. Unexpected errors fail the property; an
  expected-outcome branch never suppresses them.
- Derive invariants from an independent contract or a simpler model, never a copy of the production
  algorithm.
- Start each generated case from clean state and release its resources before the next case. Use a
  tested scoped helper for case resources, with cleanup on success and failure. `onTestFinished`
  runs after the enclosing Bun test, not after each generated case; its fallback cleanup alone does
  not isolate cases.
- Preserve the seed, reduced counterexample, and applicable replay information. Add an explicit
  regression test for a discovered sequence when it represents a behavior the suite must keep.
- Keep separate assertions for independent results and tests for behavioral stand-ins. Do not reduce
  generated coverage to conceal slow tests. The interpreter needs no rewrite into command classes
  solely for alignment.

## Setup and cleanup

Process-wide setup and cleanup belong to the preload. Per-test setup belongs to one local function,
`setupTest()`, that the test calls itself. `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`
never appear in a test file.

### `setupTest`

- `setupTest()` builds the runtime the test needs: temp directories, servers, clients, database
  handles, recorders. It takes a typed config object, returns named properties, and has no `if`. Its
  config chooses which dependencies to wire, and it never carries scenario data.
- The scenario belongs to the test body: every row, override, and value that selects the case, such
  as agent entries or authentication tokens. A scenario value stays there even when every test uses
  the same value. `setupTest()` may write boot data without which the unit cannot run; each value
  carries a one-line comment that states why boot needs it.
- Return runtime handles and generated infrastructure paths from `setupTest()` as named properties,
  such as a database handle, a temporary directory, or a VM's system path. They remain runtime
  wiring when a test compares them. Keep the scenario's choice of resource or generation visible in
  the test body.
- An earlier act that the test's one act depends on, such as starting the session that the test
  attaches to, is arrangement. No assertion checks it, because a separate test covers that act.
  `setupTest()` runs it and returns the handles it produced. An earlier act that carries scenario
  data, such as saving the note that the test then archives, stays in the arrange phase of the test
  body instead, because `setupTest()` never carries scenario data. An earlier action that only some
  tests need stays visible in those tests' arrange phase without assertions; do not hide it behind a
  conditional setup flag.
- A test file declares one function, `setupTest()`, and nothing else. A helper the tests want goes
  one of three ways: inline it where it is used, swap it for a registered matcher, or move it to the
  shared test utils with tests of its own. A file with nothing to wire has no `setupTest()`.
- Each test file keeps its own `setupTest()`. A shared one gathers a flag for every suite that uses
  it.

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
beside the acquisition, and needs no `?.` guard for a resource the test never reached. A shared test
util may register `onTestFinished` for its callers. These helpers must run inside a test.

When resources have cleanup dependencies, register one callback that closes them in the required
order. Every cleanup must run even if another cleanup throws. Use a disposable stack when reverse
acquisition order matches those dependencies, and register its disposal immediately. Do not hold
that stack with `using` or `await using`, or transfer it with `move()`.

```ts
async function setupTest() {
  const stack = new AsyncDisposableStack();

  onTestFinished(() => stack.disposeAsync());

  const dir = await mkdtemp(join(tmpdir(), 'notes-'));

  stack.defer(() => rm(dir, { recursive: true, force: true }));

  const db = new Database(join(dir, 'notes.db'));

  stack.defer(() => db.close());
  applyNotesMigrations(db);

  return { dir, db };
}
```

If the scenario needs an explicit shutdown before the next action, call it in the test body. Keep
fallback cleanup registered and make it safe after shutdown. Fixture callers need no `using` or
`await using` declaration.

`onTestFinished` runs after all `afterEach` hooks, including the preload's resets. Cleanup uses
captured paths and handles, rather than environment overrides that those resets remove. Tests that
use this hook run sequentially within each file: do not enable `test.concurrent`, `--concurrent`, or
`concurrentTestGlob` for them. Separate worker processes and CI jobs can still run in parallel.

```ts
test('it reads a note written by another connection', async () => {
  const ctx = await setupTest();

  const writer = new Database(join(ctx.dir, 'notes.db'));
  onTestFinished(() => writer.close());

  writer.run(`INSERT INTO notes (title) VALUES ('from writer')`);

  expect(listNoteTitles(ctx.db)).toStrictEqual(['from writer']);
});
```

A test overrides an environment variable through the repo's env util, and the preload restores every
override after each test. A test never assigns `process.env` directly. A test never relies on a
unique key to avoid another test's rows: isolation comes from resets, not from luck.

### A test that fails only in the full run

A test that passes alone and fails beside others has found a cleanup gap. Find it this way:

1. Run the failing test alone, and confirm it passes.
2. Run it with half of the other test files, and keep halving toward the half that still makes it
   fail.
3. In the file that remains, find the state it leaves behind: a module cache, a singleton, a store,
   an unrestored override.
4. Add that state's reset to the preload.

Reordering the tests or choosing unique keys hides the gap and leaves it for the next test to find.

## Test data

- Plain inputs stay inline at the call site: arguments, options bags, config values. Write the
  literal again in the next test. A module-level fixture, a baseline object shared between tests, or
  a constant that only names a literal (`const EMPTY = ''`) never appears in a test file.
- A domain type that crosses a module boundary gets a factory, `build-mock-<type>.ts` exporting
  `buildMock<Type>`, in the shared test utils as soon as a test needs one. A factory returns a value
  and brings no resource into existence, so it takes the `build` prefix from the AGENTS.md naming
  table. A composite that writes rows creates a resource and keeps `create`. A type that another
  package owns, such as an SDK result, is in the same position on first use. A type private to the
  module under test stays an inline literal.
- A factory returns a complete plain object. Fields whose value is arbitrary default to
  `@faker-js/faker` values, which prove the unit does not depend on one particular value.
  Constrained fields, such as an enum or a discriminator, take a fixed default. A deterministic
  package, whose outputs are pinned as golden values, takes fixed defaults throughout. The preload
  seeds faker once, so a failing run reproduces.
- A factory defaults each foreign key to a fresh id and never requires a parent. Wiring real parents
  is a composite's job.
- A factory for a class returns an instance of that class, so `toStrictEqual` against a real
  instance passes. A factory with nested fields deep-merges each override into fresh defaults.
- A row factory returns the table's insert shape, and a contract factory returns the API type. They
  are separate factories, kept in the packages that own each shape.
- Each factory has a test file with at least two tests: `it builds a default <type>`, which asserts
  the whole shape with `toStrictEqual` and asymmetric matchers, and
  `it applies overrides on top of the defaults`. Add a test only for a factory branch that those two
  cannot reach, such as an override that leaves out an optional field (`undefined` meaning absent),
  a field derived from another field, or a keyed or nested override that builds each child from its
  own factory. Each added test fails when that branch is deleted. Never add one that checks faker's
  output or the plain merge of overrides again.
- The test that uses a factory's value calls the factory itself. A helper that presets overrides is
  a second set of defaults that the reader cannot see.
- A runtime stand-in that implements behaviour or assumptions about a dependency lives in the shared
  test utils under a name for what it impersonates. Its prefix follows the AGENTS.md naming table. A
  stand-in that starts something long-running, such as a stub server, is `start-stub-<thing>.ts`. A
  stand-in that creates a resource, such as a stub repository on disk, is `create-stub-<thing>.ts`.
  Every other stand-in is `build-stub-<thing>.ts`. It has its own tests, which pin the assumptions
  it makes about the real thing. An executable stand-in script uses `run-stub-<thing>.ts`; an
  imported helper that starts it keeps `start-stub-<thing>.ts`.
- Keep bare call recorders (`mock()` with no implementation) and no-op callbacks (`() => {}`)
  inline, including a recorder inside an object such as `{ sendEvent: mock() }`. Never extract a
  wrapper or add a test whose only purpose is to check that the mocking library records calls. A
  no-op executable placeholder stays inline through the shared file helper when the test needs only
  an executable. Extract a dedicated stand-in when the script models arguments, output, or failures.

### Composites

A composite assembles one domain concept from factories and persistence helpers: a signed-in user
with its session, or an order with its customer. It creates each dependency that the caller does not
pass, and it returns data, never clients, apps, or servers.

- A composite's name is a concept the system already names. Two readers who see just the name
  describe the same contents. A name that lists its parts, such as
  `createUserWithTwoNotesAndAShare`, is a convenience grouping: compose the primitives in the test
  instead.
- A variant is a separate file and export, such as `createAdminUser` beside `createUser`. It is
  never a flag inside one composite.
- A composite has no batch form. Several records are several calls.

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

  Pass the expected partial object directly. Never read `issues[0]`, which ties the test to issue
  order.

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
- A recovery test checks that the injected fault occurred and that recovery succeeded. Capture the
  earlier state during arrangement, then assert it at the end alongside the final state; use
  separate scalar assertions for each state.
- After a mutation, one `toBe` on the field that changed is enough.
- Snapshots are inline only. `toMatchInlineSnapshot` pins a golden value: deterministic machine
  output that no person derives by reading the code, such as a generated SQL string or a rendered
  report. A value a person wrote by hand, such as a spec test vector, keeps an explicit matcher,
  because a snapshot of it would bless whatever the code produced. File snapshots and component
  snapshots never appear.
- A deterministic pipeline's suite opens with two tests. A frozen-golden test feeds one hand-written
  literal input and pins the full output inline. A determinism test asserts that the same input
  gives equal outputs: `expect(run(input)).toStrictEqual(run(input))`. The golden input is never a
  factory call, because regenerating snapshots must never change the input.
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
- Each error that a unit declares has its own test.
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
3. **Fake timers.** Code with no injection point, such as a third-party library, gets
   `setSystemTime()` and fake timers. The test restores them in `onTestFinished`.

A value that depends on the wall clock is built relative to `Date.now()`
(`expiresAt: new Date(Date.now() - 1000)`) and asserted with range matchers such as `toBeAfter` and
`toBeWithin`, never with an exact timestamp.

A test waits on a condition with a polling `waitFor`, never with a sleep. A sleep makes the suite
slower by its full length on every run, and it still fails on a slow machine. When the code offers
nothing observable to wait on, the code lacks a signal: add one, such as an event, a log marker, or
a state flag, and wait on that.

### Native timers and scenario delays

A test of a native runtime or kernel timer uses the shortest faithful configurable deadline through
the real mechanism. Configure startup-only settings in an isolated child process. Include a failure
control that proves an unprotected operation crosses the deadline; a nominal timeout value alone
does not prove expiry. Keep default configuration coverage separate. Wait out the real default only
when the runtime cannot expose a shorter faithful deadline, and run that case through an explicit
script.

A real delay may define an end-to-end workload rate or a seeded fault-injection offset. State the
rate or fault purpose and preserve replay information. A claim that a fault lands mid-operation
needs evidence of overlap and checks of the fault and recovery. Use phase-targeted checks for known
races. A delay that only guesses when a service settles remains a condition wait; elapsed age must
matter to the contract to justify a dwell.

## Boundaries

Stand-ins replace a boundary, never the code inside it. A test never stubs `fetch`, an HTTP client,
or a method of the unit's own services: the path from the call to the boundary runs for real,
including serialisation and error handling.

| Boundary                                       | The test uses                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Pure computation                               | Return values, with no stand-in                                                       |
| A CLI                                          | The real binary, spawned end to end                                                   |
| The filesystem                                 | A real `mkdtemp` tree per test                                                        |
| A database                                     | The real engine, isolated per test, as [database](./references/database.md) describes |
| A remote HTTP or RPC service                   | MSW handlers, as [HTTP mocking](./references/http.md) describes                       |
| A service with a cheap container               | The real service in a container                                                       |
| An SDK with a command layer                    | A stand-in at the command layer                                                       |
| A queue or pub/sub without a faithful emulator | A wrapper with queryable state, as [HTTP mocking](./references/http.md) describes     |

A module that is hard to test without a stand-in takes its I/O from its caller: test the pure core
with values, and test the I/O edge against the real boundary.

### Real applications and transport

A CLI, SDK, or server-side client of a service in the same repo tests against the real application
wiring, with isolated data and stand-ins at host boundaries the runtime cannot run. A child process
reaches that application through a real listener. Frontend component tests keep the MSW boundary in
[frontend testing](./references/frontend.md), with the real SDK and RPC serialization.

Use a tested real network stand-in where interception cannot exercise the contract: certificate
verification, TLS or tunnel behavior, Unix sockets whose native options interception loses, or
requests from a child process, container, or VM outside the intercepted process. Confirm a claimed
interceptor limitation with the installed versions. Keep real routing and serialization,
schema-backed rich mock state, and visible failures for unexpected calls. Ordinary remote HTTP
behavior keeps MSW where it applies.

### Filesystem

A real temp tree costs about 1 to 2 ms per test for a handful of small files, and more as the tree
grows. A test pays that for real behaviour: `fs.watch`, permissions, symlinks, `Bun.file`, and
`Bun.write`, which an in-memory filesystem fakes or misses. Take every path from the temp root and
pass it into the module. Never steer a module through `process.cwd()` or through a `HOME` value set
after startup, because Bun reads some of those once at startup.

### Program-fixed paths and global resources

Kernel or program contracts may impose a path inside the test environment, such as a certificate
trust directory, procfs, or a VM mount point. State which contract fixes it. Use a fresh test-owned
namespace or resource with checked ownership; choose a disposable environment when ownership cannot
be guaranteed. Each test creates fresh scenario resources and cleans them up.

Distinct names for machine-global resources allocate a namespace, like `mkdtemp`; they never replace
row or store isolation. Refuse collisions with resources this run does not own before overwriting,
truncating, mounting, or deleting them. Register cleanup immediately after successful acquisition,
and release only what this run acquired. A generated name is not proof of ownership. Cleanup remains
safe after partial failure, interruption, and explicit shutdown.

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

`mock.module` never appears in a test file. In one process, a module mock in one file applies to
every file that loads after it. Two kinds of module mock are legal, and each lives in a preload
module named `register-<module>-mock.ts`:

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
not exist. Prefer a matcher to a hand-written check:

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
