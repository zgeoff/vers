# System tests

Never sleep to let a service settle. Wait on a condition. Never overwrite, truncate, mount or delete
a host resource that this run didn't create. Never mark a Rust lane test with `#[ignore]`: no lane
runs it, and no one sees it stop.

These rules add to the [testing skill](../SKILL.md) for a test that runs a whole program, a browser
or a VM, or that touches something the whole host shares, such as a kernel timer or a fixed path.
Jump to the section for your test:

- [End-to-end suites](#end-to-end-suites)
- [Real applications and transport](#real-applications-and-transport)
- [Stateful stand-ins](#stateful-stand-ins)
- [Browser suites](#browser-suites)
- [Native timers and scenario delays](#native-timers-and-scenario-delays)
- [Property tests](#property-tests)
- [Evaluation suites](#evaluation-suites)
- [Golden tests](#golden-tests)
- [Program-fixed paths and global resources](#program-fixed-paths-and-global-resources)
- [Rust lanes](#rust-lanes)

## End-to-end suites

Put a flow across several packages, run in one process, in `integration/`. Put tests that drive the
built product from outside in `e2e/`: tests of the process itself, such as start-up, signals, exit
codes and crash recovery, and one happy-path journey per main user flow. Test edge cases and denials
in process.

Give each user journey its own file in `e2e/`, such as `e2e/checkout.test.ts` beside
`e2e/refund.test.ts`, with its own setup, scenario and cleanup. Inside a journey, you may chain acts
and the assertions on them, because each step needs the state that the step before it left. Outside
`e2e/`, a test still acts once.

- To share an expensive host or service across journeys, start and stop it in an outer harness. Wire
  everything else in each file's own `setupTest`, as [setupTest](../SKILL.md#setuptest) says.
- Reset the shared host or service to its starting state before each journey. When a reset can't do
  that, build the host or service again.
- Test the reset in the harness package's own tests. Dirty the state, run the reset, and check the
  starting state. Do it again after a failed journey and after an interrupt, such as a `SIGINT` to
  the process that runs the journey.
- Test each argument and flag of a CLI through its real parser in a module test, and keep the code
  that builds the CLI's commands importable for it. Run the built binary only in the `e2e/`
  journeys.

## Real applications and transport

Test a client that the repo ships, such as a CLI or an SDK, against the real service from the same
repo. Give each test data that only it uses. Use a stand-in only for a host boundary that the
runtime can't run.

In the unit run, call the service in the test's process, as
[the cause table](./slow-tests.md#causes-and-fixes) says. When the client runs as a child process,
start the service on a real port, so the child reaches it, and put the test in `e2e/`.

For a remote HTTP service, use MSW, as in [Boundaries](../SKILL.md#boundaries). Write a stand-in
server on a real socket only when MSW can't intercept the call, such as:

- a call that checks a certificate, or goes through TLS or a tunnel;
- a call on a Unix socket whose options MSW drops;
- a request from a child process, a container or a VM.

Try MSW on the call first, with the version the repo installs. In a stand-in server, keep real
routing and serialization, back its state with a schema, and fail loudly on each call it doesn't
expect.

## Stateful stand-ins

When the repo starts a program in another process and drives it over its own protocol, such as a
worker, a language server or a sandboxed guest, test the host against a stateful stand-in of the
program:

- Send and accept the real messages over the real framing.
- Keep the state the program keeps, and answer from that state.
- In a test, shape the state through the stand-in's methods, and drive the host through its real
  code.
- Run the real program only in the program's own suite, so the host's tests start no process.

Write a stand-in with state, never one that each test scripts. With a scripted stand-in, each test
writes out the program's behaviour again, and the stand-in accepts a message the real program
refuses, so a host bug passes.

In this made-up example, a build host sends jobs to a worker process that keeps a cache of
checked-out repositories. When the host skips the checkout for a repository the worker evicted, the
stand-in refuses the build, as the real worker does:

```ts
test('it checks a repository out again after the worker evicts it', async () => {
  const ctx = await setupTest(); // the build host, wired to the stand-in worker

  await ctx.host.build({ repo: 'acme/api', ref: 'main' });

  ctx.worker.evict('acme/api');

  await ctx.host.build({ repo: 'acme/api', ref: 'main' });

  expect(ctx.worker.received.map((message) => message.type)).toStrictEqual([
    'checkout',
    'build',
    'checkout',
    'build',
  ]);
});
```

A scripted worker answers the second `build` with whatever its script holds, so a host that never
sends the second `checkout` still passes.

Keep the stand-in in `test-utils/` as `start-stub-<program>.ts`, with its own tests, as in
[Test data](../SKILL.md#test-data). In each of those tests, check one behaviour the stand-in copies
from the real program, such as the refusal for an evicted repository.

When the stand-in makes up a value, such as a fake hash or a fake signature, assert only its
properties: its shape, that the same input gives the same output, and that different inputs give
different outputs.

## Browser suites

Name a browser suite `<module>.browser.test.ts`, beside the module it tests, and run it in the
browser lane of [`@zgeoff/rig`](https://github.com/zgeoff/tools/tree/main/packages/rig) with
`bun run test:browser`. The lane's preload starts Chrome. In `setupTest`, open a view on that Chrome
with `new Bun.WebView({ backend: 'chrome' })`, and close the view in `onTestFinished`. To set up the
lane, its build and its memory cap, follow
[Setting up the browser lane](https://github.com/zgeoff/tools/blob/main/docs/guides/browser-lane.md).

Never run Playwright under `bun test`. Use Playwright only for an `e2e/` lane that needs Firefox,
WebKit on Linux or a live system, because `Bun.WebView` has no Firefox and runs WebKit only on
macOS.

### Page code

Send page code longer than one line through `runInPage(view, fn, arg, schema)` from `@zgeoff/rig`,
never as a string passed to `view.evaluate`. Write the page code as a real function in the test, so
the type checker and the linter check it.

- Pass the function everything it reads in `arg`. The function runs in the page and sees only its
  argument and the page's globals, so a test variable in its body passes the type check and throws a
  `ReferenceError` in the page.
- Parse the result with a zod schema, with no cast. The parse also fails a result that JSON can't
  carry, such as a `Blob`, which arrives as `{}`.
- Leave a one-line `view.evaluate` call as it is.

### Time and helpers

- Keep the browser lane's 10 s limit in every browser suite. Never give a browser test the disable
  comment for a test over its limit.
- When a browser test runs longer, find its cause in
  [the cause table](./slow-tests.md#causes-and-fixes). Move a build out of the test and into the
  lane's `build:browser` script. Replace a fixed wait with a wait for the element or the event.
  Split a test of a whole user flow into a test per component or page.
- Test a journey through the client's routes in a browser suite. Test a journey of the built
  product, through its bundle or binary, in `e2e/`, as
  [Where a test lives](../SKILL.md#where-a-test-lives) describes.
- Give each browser helper of the repo's own, such as one that opens a view, its own test file.
- Keep every test that needs no page out of a browser suite, so it runs in the fast unit run.

## Native timers and scenario delays

Find which kind of timer your test waits on, then follow the rules under its heading.

### A timer the runtime or the kernel runs

- Set the timer, such as a server's idle timeout, through its real setting, to the shortest value
  that still behaves like the real one. When the runtime reads the setting only at start-up, start a
  child process for this test alone, with the setting.
- Check that the timer fires. Add a second test that stops whatever keeps the operation inside the
  timeout, such as a keep-alive ping, and checks that the timeout then ends the operation. A test
  that only sets a short value never sees the timer fire.
- Test the default value in its own test. Wait out the real default only when the runtime has no
  shorter setting that behaves the same. Wait for the timeout's event with `waitFor`, and keep the
  test in the unit run with the disable comment that the "A test over its limit" section of
  [Slow tests and lanes](./slow-tests.md) gives.

### A timer inside a library

- Pass the shortest duration the library accepts, and wait on an event you can see.
- When the timer ends a silent peer, such as a heartbeat timeout, add a second test that shows the
  same duration doesn't fire while the peer still answers.
- Use fake timers only when the library's timers don't interleave with real I/O.

### A deadline in a process the test spawns

When the repo's code sets a deadline in a process the test spawns, such as a crash harness's settle
window, read its length from an option of that code, or from a constant exported outside the test
file. Wait on a condition that the test checks or the process reports.

### A deadline in the test's own process

When the repo's code sets a deadline in the test's own process, including with a `setTimeout`, pass
the time in as an argument or an injected clock, in the order
[Time and waiting](../SKILL.md#time-and-waiting) gives.

### Delays in a scenario

You may use a real delay to set the rate of an end-to-end workload or the offset of a seeded fault.
Name the rate or the fault in a comment, and keep the seed. To claim that a fault lands in the
middle of an operation, assert the order of the operation's start, the fault and the operation's
end, from events the code emits. Check both the fault and the recovery. Use a fixed wait only when
the elapsed time is part of the contract.

## Property tests

You may assert in a loop over a list the module exports, such as a table of commands, to check that
each entry is complete, and await each case that fast-check generates in a loop.

Use fast-check when the combinations of generated inputs or of operation sequences matter. For a
fixed list of cases, use `test.each`. Await an async `fc.assert`, so a failed property fails the
test.

Inside the property runner and the function that applies each generated operation, you may loop over
operations, branch on the expected outcome, and check invariants after each operation. Every other
test still follows the testing skill's rules on loops, branches and one act per test.

- Check the transitions that matter, as well as the final state. Let an unexpected error fail the
  property. Never catch it in a branch for an expected outcome.
- Derive invariants from an independent contract or a simpler model, never from a copy of the
  production algorithm.
- Start each generated case from clean state, and release its resources before the next case. Get
  them from a tested helper that cleans up inside the case, on success and on failure.
  `onTestFinished` runs once, after the whole Bun test, so it can't keep the generated cases apart.
- When a property fails, fast-check prints the seed, the path and the shrunk counterexample. Replay
  the failure by passing that `seed` and `path` to `fc.assert`. When the counterexample shows
  behaviour the suite must keep, add a fixed test with it.
- Never cut generated cases to make a suite faster. Fix the cause from
  [the cause table](./slow-tests.md#causes-and-fixes).

## Evaluation suites

Put a suite in `evals/` when it replays a committed corpus of recorded traffic through the
production path, or checks a committed evaluation report against the code. The suite tests a corpus,
so it has no module to sit beside. `evals/` isn't a lane, so the suite runs in the unit run on every
pull request, under the 5 s limit.

- Read the committed corpus or report through one tested loader. Never copy its cases into the test
  as literals.
- Keep helpers in a workspace package outside `evals/`, with tests of their own.
- Use a stand-in only for what a recording can't reproduce, such as the disk or the code host's API,
  and inject it into the production path.
- Make the suite fail when the report and the code disagree, such as by building the report from the
  code in the test and comparing it with the committed one. A suite that passes on a stale report
  checks nothing.
- Give a test that calls a live model the `.model-api` suffix, because it replays nothing. It then
  runs in that lane, as [Lanes](./slow-tests.md#lanes) describes.

## Golden tests

Use only inline snapshots, never of a component, and only for machine output that no person works
out, such as generated SQL. Check a hand-written value, such as a spec test vector, with an explicit
matcher.

For any pipeline whose output depends only on its input, in `evals/` or beside its module, write a
golden test and a determinism test:

- In each golden test, write one input by hand as a literal, and pin the full output in an inline
  snapshot. Never build the input with a factory call. A change to the factory would change the
  input, and updating the snapshot would hide that.
- When the output is a file the repo commits, such as an OpenAPI document, compare the output with
  that file in place of an inline snapshot.
- In the determinism test, assert that the same input gives equal outputs:
  `expect(run(input)).toStrictEqual(run(input))`.

## Program-fixed paths and global resources

When a kernel or a program fixes a path, such as a certificate trust directory, procfs or a VM mount
point, name the program or the spec that fixes it in a comment.

- Put the path inside something the test created, such as a temp directory, a mount namespace or a
  container. Check that the path is inside it before you write there. When you can't check that, use
  a VM or a container that only this run uses.
- Create each test's own files and records in that test, and clean them up.
- Give a resource that the whole machine shares a name that sets this run apart, the way `mkdtemp`
  does.
- Before you overwrite, truncate, mount or delete a resource, check that this run created it, such
  as from a list the run keeps of what it made. A generated name alone proves nothing.
- Register cleanup right after you acquire a resource, and release only what this run acquired. Make
  the cleanup safe to run after a partial failure, an interrupt, or a shutdown that already released
  the resource.

## Rust lanes

Run a Rust crate's lanes through cargo-nextest, with the limits in [Lanes](./slow-tests.md#lanes).
Mark a lane with a test path prefix, such as `e2e::` or `host::`, as a folder or a file suffix does
for Bun. Define the lanes in the repo's `.config/nextest.toml`, as in this made-up example:

```toml
[profile.default]
slow-timeout = { period = "5s", terminate-after = 1 }
default-filter = "not (test(/^e2e::/) | test(/^host::/))"

[profile.e2e]
default-filter = "test(/^e2e::/)"
slow-timeout = { period = "15s", terminate-after = 1 }

# 48 s on CI, OPS-212
[[profile.e2e.overrides]]
filter = "test(=e2e::restores_a_volume_from_its_oldest_snapshot)"
slow-timeout = { period = "60s", terminate-after = 1 }
```

- Run the unit tests with the default profile. Its `slow-timeout` ends a test at the 5 s limit, and
  its `default-filter` leaves out every lane prefix.
- Give each lane one profile, with the lane's prefix in `default-filter` and the lane's limit in
  `slow-timeout`. A profile takes every setting it doesn't set from `default`. Run the lane with
  `cargo nextest run --profile <lane>`.
- Give a test over its limit an override in its profile, with a comment that gives the time it takes
  on CI and a ticket, or `floor:` and its evidence, as the "A test over its limit" section of
  [Slow tests and lanes](./slow-tests.md) says.
- Never mark a lane test with `#[ignore]`. nextest runs an ignored test only with `--run-ignored`,
  which no lane's command passes, so the test stops running and no one sees.
