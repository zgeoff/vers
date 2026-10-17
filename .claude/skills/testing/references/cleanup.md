# Cleanup

These rules cover cleanup past the common case in the [testing skill](../SKILL.md#cleanup): helpers
that register cleanup for their callers, resources that must close in order, cleanup that runs after
the preload's resets, and finding the gap when a test fails only in the full run.

- [Helpers that register cleanup](#helpers-that-register-cleanup)
- [Ordered cleanup](#ordered-cleanup)
- [Cleanup after the resets](#cleanup-after-the-resets)
- [A test that fails only in the full run](#a-test-that-fails-only-in-the-full-run)

## Helpers that register cleanup

A shared test util may register `onTestFinished` for its callers. These helpers must run inside a
test. A test of such a helper proves its cleanup ran by asserting in an `onTestFinished` hook.
`onTestFinished` hooks run first-in, first-out, so register that check after the helper's call, and
register the removal of any directory the check reads after the check, not immediately after
creating it. This is the only place an assertion leaves the test body.

A helper whose cleanup only stops work that a passing test always finishes first, such as killing a
build that is still running, needs no test that proves that cleanup.

## Ordered cleanup

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

  return { dir, db, stack };
}
```

If the scenario needs an explicit shutdown before the next action, call it in the test body. Keep
fallback cleanup registered and make it safe after shutdown. Fixture callers need no `using` or
`await using` declaration.

A listener that a test opens only to read a free port needs no fallback cleanup when the statement
after the port read stops it.

## Cleanup after the resets

`onTestFinished` runs after all `afterEach` hooks, including the preload's resets. Cleanup uses
captured paths and handles, rather than environment overrides that those resets remove. Tests that
use this hook run sequentially within each file: do not enable `test.concurrent`, `--concurrent`, or
`concurrentTestGlob` for them. Separate worker processes and CI jobs can still run in parallel.

```ts
test('it reads a note written by another connection', async () => {
  const ctx = await setupTest();

  const writer = new Database(join(ctx.dir, 'notes.db'));

  ctx.stack.defer(() => writer.close());

  writer.run(`INSERT INTO notes (title) VALUES ('from writer')`);

  expect(listNoteTitles(ctx.db)).toStrictEqual(['from writer']);
});
```

## A test that fails only in the full run

A test that passes alone and fails beside others has found a cleanup gap. Find it this way:

1. Run the failing test alone, and confirm it passes.
2. Run it with half of the other test files, and keep halving toward the half that still makes it
   fail.
3. In the file that remains, find the state it leaves behind: a module cache, a singleton, a store,
   an unrestored override.
4. Add that state's reset to the preload.

Reordering the tests or choosing unique keys hides the gap and leaves it for the next test to find.
