---
name: testing
description:
  Testing rules for zgeoff Bun repos — the three package regimes, flat behavioural tests, a
  disposable setupTest, inline data and tested factories, strict assertions and inline snapshots,
  injected time, no sleeps, real filesystems and transports, and the narrow cases for module mocks.
  References cover real databases, React and TanStack clients, HTTP mocking with MSW, and
  observability. Load when designing, writing, or reviewing tests.
---

# Testing

`bun test` loads every test file into one process, so state that one file leaves behind is state the
next file sees. The repo's `bunfig.toml` preload owns that process: it registers the matchers, the
mock server lifecycle, and every reset that returns shared state to a clean baseline after each
test. A test file holds no lifecycle hooks. A test exercises real behaviour through real code, and
it reaches for a stand-in only at a boundary the test cannot cross. When existing tests break these
rules, you align them while you work on the code they cover.

This skill is the shared base that repo-sync delivers from zgeoff/tools: edit it there, never in a
downstream copy. When the repo has a `project-testing` skill, load it as well. That skill adds this
repo's harnesses, regimes, and stricter rules. A project skill never relaxes a rule here; a repo
that needs an exception changes this skill.

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
- A test body arranges, acts, then asserts, and a blank line separates each phase. Phase comments
  such as `// act` never appear. A test acts once: it has one act phase, which may hold several
  calls whose combined result the assertions check, such as the two runs that a determinism test
  compares. A body with two independent act-and-assert pairs holds two tests, so split it. When a
  second act depends on the first, the first act becomes arrangement, as `setupTest` describes. A
  pure function's test may collapse the three phases into one `expect` line.
- `test.each` serves a closed decision table only: rows of plain data, and a title template that
  starts with "it" and interpolates the input that varies. Any other set of cases gets a separate
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
step of the journey needs the state that the step before it left. This holds only in `e2e/`: every
other test acts once.

### Loops

A loop that runs an assertion once per input hides which input failed, and its first failure stops
the rest. Replace it with `test.each`, or write each case as its own test. A loop of `expect` calls
over the items of one result becomes one collection matcher, which reports the whole collection on
failure:

```ts
expect(listOpenNotes(store)).toSatisfyAll((note: Note) => note.archivedAt === null);
```

Two loops stay legal, because each checks a set the module owns rather than a set of inputs:

- A completeness loop that walks a module's own registry, such as checking that every exported
  renderer has a preview.
- A conformance loop that drives each generated case through
  `await expect(conformanceCase.run(app)).toResolve()`.

Neither loop may compute its expectation with the same transformation it checks. A loop that only
arranges, such as inserting 51 rows to cross a page limit, holds no assertion and stays legal.
Prefer `await Promise.all(Array.from({ length: 51 }, …))` when the order of the rows does not
matter.

## Setup and cleanup

Process-wide setup and cleanup belong to the preload. Per-test setup belongs to one local function,
`setupTest()`, that the test calls itself. `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`
never appear in a test file.

### `setupTest`

- `setupTest()` builds the runtime the test needs: temp directories, servers, clients, database
  handles, recorders. It takes a typed config object, returns named properties, and has no `if`. Its
  config chooses which dependencies to wire, and it never carries scenario data.
- The scenario belongs to the test body: every row, every override, and every value an assertion
  depends on. `setupTest()` may write boot data, meaning data without which the unit cannot run at
  all. Two questions sort a value. Does any test in the file assert on it, or need a different value
  of it? Does `setupTest()` return it, or take a config field for it? A yes to either question makes
  the value scenario data, and it moves into the test body. Boot data carries a one-line comment
  that names what needs it.
- An earlier act that the test's one act depends on, such as starting the session that the test
  attaches to, is arrangement. No assertion checks it, because a separate test covers that act.
  `setupTest()` runs it and returns the handles it produced. An earlier act that carries scenario
  data, such as saving the note that the test then archives, stays in the arrange phase of the test
  body instead, because `setupTest()` never carries scenario data.
- A test file declares one function, `setupTest()`, and nothing else. A helper the tests want goes
  one of three ways: inline it where it is used, swap it for a registered matcher, or move it to the
  shared test utils with tests of its own. A file with nothing to wire has no `setupTest()`.
- Each test file keeps its own `setupTest()`. A shared one gathers a flag for every suite that uses
  it.

When `setupTest()` acquires a resource that closes asynchronously, it returns `Symbol.asyncDispose`
and the test holds it with `await using`, so teardown runs whether the test passes or throws. Gather
several resources in one `AsyncDisposableStack`: it releases them in reverse order, so a server
stops before the database it reads is closed. Hold the stack with `await using` while setup runs,
and hand it to the test with `stack.move()`, so a setup step that throws still releases what the
stack holds.

```ts
async function setupTest() {
  await using stack = new AsyncDisposableStack();
  const dir = await mkdtemp(join(tmpdir(), 'notes-'));

  stack.defer(() => rm(dir, { recursive: true, force: true }));

  const db = new Database(join(dir, 'notes.db'));

  stack.defer(() => db.close());
  applyNotesMigrations(db);

  const owned = stack.move();

  return { dir, db, [Symbol.asyncDispose]: () => owned.disposeAsync() };
}

test('it lists a note after it is saved', async () => {
  await using ctx = await setupTest();

  await saveNote(ctx.db, { title: 'groceries' });

  expect(listNoteTitles(ctx.db)).toStrictEqual(['groceries']);
});
```

When every resource that `setupTest()` acquires closes synchronously, such as an in-memory SQLite
handle, `setupTest()` returns `Symbol.dispose` from a `DisposableStack`, and the test holds it with
a plain `using`. The setup is then not async, and the test is async only when its own body awaits.
One resource that closes asynchronously makes the whole setup take the async form.

```ts
function setupTest() {
  using stack = new DisposableStack();
  const db = new Database(':memory:');

  stack.defer(() => db.close());
  applyNotesMigrations(db);

  const owned = stack.move();

  return { db, [Symbol.dispose]: () => owned.dispose() };
}

test('it counts the notes in the store', () => {
  using ctx = setupTest();

  insertNote(ctx.db, { title: 'groceries' });

  expect(countNotes(ctx.db)).toBe(1);
});
```

A `setupTest()` that acquires nothing returns no dispose method, and the test holds it with a plain
`const`. Hold the result in one binding and read its members; never destructure it. The binding
names are fixed: `ctx` for `setupTest()`, `hook` for `renderHook(…)`, and `rendered` for
`render(…)`.

### Cleanup

Each kind of state has one cleanup tool.

| State                                  | Cleanup                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A resource that `setupTest()` acquires | Its dispose, through `using ctx`, or `await using ctx` when a resource closes asynchronously                |
| A resource that the test body opens    | `onTestFinished(…)` on the line after the open, or `using` or `await using` when the resource is disposable |
| Process state the test body changes    | `onTestFinished(…)` on the line after the change                                                            |
| State that a preload reset covers      | Nothing                                                                                                     |

`try`/`finally` never appears in a test. `onTestFinished` runs on failure as well, it keeps teardown
beside the line it reverses, and it needs no `?.` guard for a resource the test never reached. A
shared test util may register `onTestFinished` for its callers.

```ts
test('it reads a note written by another connection', async () => {
  await using ctx = await setupTest();

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
- Each factory has a test file with two tests: `it builds a default <type>`, which asserts the whole
  shape with `toStrictEqual` and asymmetric matchers, and
  `it applies overrides on top of the defaults`.
- The test that uses a factory's value calls the factory itself. A helper that presets overrides is
  a second set of defaults that the reader cannot see.
- A runtime stand-in, such as a stub connection, a fake worker context, or a recorder, lives in the
  shared test utils under a name for what it impersonates. Its prefix follows the AGENTS.md naming
  table. A stand-in that starts something long-running, such as a stub server, is
  `start-stub-<thing>.ts`. A stand-in that creates a resource, such as a stub repository on disk, is
  `create-stub-<thing>.ts`. Every other stand-in is `build-stub-<thing>.ts`. It has its own tests,
  which pin the assumptions it makes about the real thing.

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
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['title'] }));
  ```

  Never read `issues[0]`, which ties the test to issue order.

- An acceptance test asserts `result.data`. For a schema that passes values through, assert
  `toStrictEqual(payload)`. For one that transforms, assert the transformed value. A bare
  `success: true` passes for a schema that strips or coerces a field wrongly.

## Assertions

- Use `toStrictEqual` when the test determines every field of the expected value: the full shape is
  the contract. When the value carries fields that the test does not determine, such as faker
  defaults, timestamps, or generated ids, use asymmetric matchers inside `toStrictEqual`, or
  `toMatchObject`. Choosing a partial match because the full literal is long is a defect. `toEqual`
  never appears.
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
  await using ctx = await setupTest();

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

A test body never branches. Each path through the unit gets its own test.

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

An assertion inside a callback passes when the callback never runs. Copy the value out of the
callback into a variable, then assert on it once the call returns.

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
| An HTTP or RPC service                         | MSW handlers, as [HTTP mocking](./references/http.md) describes                       |
| A service with a cheap container               | The real service in a container                                                       |
| An SDK with a command layer                    | A stand-in at the command layer                                                       |
| A queue or pub/sub without a faithful emulator | A wrapper with queryable state, as [HTTP mocking](./references/http.md) describes     |

A module that is hard to test without a stand-in takes its I/O from its caller: test the pure core
with values, and test the I/O edge against the real boundary.

### Filesystem

A real temp tree costs about 1 to 2 ms per test for a handful of small files, and more as the tree
grows. A test pays that for real behaviour: `fs.watch`, permissions, symlinks, `Bun.file`, and
`Bun.write`, which an in-memory filesystem fakes or misses. Take every path from the temp root and
pass it into the module. Never steer a module through `process.cwd()` or through a `HOME` value set
after startup, because Bun reads some of those once at startup.

### Infrastructure failures

A failure branch runs on a real failure:

- A database or socket that is down: point the real driver at an address where nothing listens, and
  destroy the handle in `onTestFinished`.
- A downstream service that errors: a per-test MSW handler that throws or returns the error status.
- One statement that fails in the middle of a flow: real state that makes it fail, such as a
  conflicting row for a constraint, or a held lock with a short `lock_timeout`.

A spy that makes one method of a real object reject never appears. A branch that neither a dead
transport nor real state can reach shows a missing seam: put that dependency behind an injected
boundary.

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
