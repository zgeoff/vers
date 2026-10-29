# System tests

These rules cover the tests that run a whole program or reach the host: end-to-end journeys,
evaluation suites, property tests, native timers, real network stand-ins, browser suites, stateful
stand-ins for a program the repo drives, resources the host fixes, and Rust lanes. The
[testing skill](../SKILL.md) rules apply throughout, and each section here names the one it relaxes.

- [End-to-end suites](#end-to-end-suites)
- [Evaluation suites](#evaluation-suites)
- [Property tests](#property-tests)
- [Native timers and scenario delays](#native-timers-and-scenario-delays)
- [Real applications and transport](#real-applications-and-transport)
- [Browser suites](#browser-suites)
- [Stateful stand-ins](#stateful-stand-ins)
- [Program-fixed paths and global resources](#program-fixed-paths-and-global-resources)
- [Rust lanes](#rust-lanes)

## End-to-end suites

An end-to-end suite splits by user journey, one file per journey: `e2e/checkout.test.ts` beside
`e2e/refund.test.ts`. A journey test may chain dependent act-and-assert phases, because each step of
the journey needs the state that the step before it left. Ordinary tests outside `e2e/` act once.
Generated sequences follow [Property tests](#property-tests).

An outer harness may reuse expensive hosts and services across journeys. Each journey keeps its own
file, setup, scenario, and cleanup. Reset shared infrastructure to a clean baseline before each
journey; test that the reset removes dirty state, including after failure or interruption. Recreate
the environment when a reset cannot restore the baseline. The harness owns infrastructure startup
and shutdown; test files keep the hook rules in [Setup and cleanup](../SKILL.md#setup-and-cleanup).

Keep command construction importable. Test argument and flag-position cases through the real parser
in module tests; keep binary journeys that check the assembled program.

## Evaluation suites

An evaluation suite in `evals/` checks production code against a committed corpus or report: it
replays a corpus of recorded traffic through the production path, or checks a committed evaluation
report against the code. It tests a corpus, not one module, so it has no module to sit beside.
`evals/` is a place, not a lane, so the suite runs in the unit run on every pull request, under the
5 s limit.

- The input is the committed corpus or report file, read through one tested loader. The cases are
  never restated as inline literals.
- Helpers live in a package outside `evals/`, with tests of their own. A stand-in replaces only what
  a recording cannot reproduce, such as the disk or the forge, and the suite injects it into the
  production path.
- A deliberate mismatch between the report and the code fails the suite. A suite that passes on a
  stale report checks nothing.
- A test that calls a live model is not a replay. It takes the `.model-api` suffix and runs in that
  lane, as [Lanes](../SKILL.md#lanes) describes.
- Every other rule in the testing skill applies to an evaluation suite.

## Property tests

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

## Native timers and scenario delays

A test of a native runtime or kernel timer uses the shortest faithful configurable deadline through
the real mechanism. Configure startup-only settings in an isolated child process. Include a failure
control that proves an unprotected operation crosses the deadline; a nominal timeout value alone
does not prove expiry. Keep default configuration coverage separate. Wait out the real default only
when the runtime cannot expose a shorter faithful deadline. That case stays in the unit run with the
disable comment that [A test over its limit](../SKILL.md#a-test-over-its-limit) describes.

When a third-party library owns a timer, runs it internally, and takes only a duration in its
config, pass the shortest duration the library accepts and wait on the observable event, never with
a sleep. Add a control: the same duration with a live peer does not fire. Fake timers stay for
libraries whose timers do not interleave with real I/O.

A deadline that the repo's own code runs on real time in a process that the test spawns, where no
clock the test injects reaches it, such as a crash harness's settle window, needs only two things: a
name, from an option of the code that owns the deadline or a constant exported outside the test
file, and a wait that ends on a condition, checked by the test or reported by the process that owns
the deadline, never on a fixed sleep. The rules above for native and library timers do not apply to
it. A deadline that the repo's own code runs in the test's own process takes a time argument or an
injected clock, in the order [Time and waiting](../SKILL.md#time-and-waiting) ranks them. A deadline
that the repo's code schedules, even with `setTimeout`, is its own. A native runtime or kernel timer
is one that the runtime configures and runs, such as a server's idle timeout; it and a library-owned
timer follow the rules above in any process.

A real delay may define an end-to-end workload rate or a seeded fault-injection offset. State the
rate or fault purpose and preserve replay information. A claim that a fault lands mid-operation
needs evidence of overlap and checks of the fault and recovery. Use phase-targeted checks for known
races. A delay that only guesses when a service settles remains a condition wait; elapsed age must
matter to the contract to justify a dwell.

## Real applications and transport

A CLI, SDK, or server-side client of a service in the same repo tests against the real application
wiring, with isolated data and stand-ins at host boundaries the runtime cannot run. A child process
reaches that application through a real listener.

Use a tested real network stand-in where interception cannot exercise the contract: certificate
verification, TLS or tunnel behavior, Unix sockets whose native options interception loses, or
requests from a child process, container, or VM outside the intercepted process. Confirm a claimed
interceptor limitation with the installed versions. Keep real routing and serialization,
schema-backed rich mock state, and visible failures for unexpected calls. Ordinary remote HTTP
behavior keeps MSW where it applies.

## Browser suites

A browser suite is a test file named `<module>.browser.test.ts` beside the module it tests. Every
browser suite uses one setup: it drives Chrome through `Bun.WebView`, the repo's shared browser
preload starts that Chrome, and a `runInPage` helper runs its page code. Playwright never runs under
`bun test`. It drives an `e2e/` lane that needs Firefox, WebKit on Linux, or a live system, because
`Bun.WebView` has no Firefox and runs WebKit only on macOS.

The repo's browser lane runs the suites at `bun test --parallel=1` after the unit run, so each file
gets its own process and Chrome starts on an idle CPU. A cold Chrome start on a CPU that the unit
run's workers saturate can outlast the test timeout, and a raised timeout only hides that cost.
[Setting up a browser lane](https://github.com/zgeoff/tools/blob/main/docs/guides/browser-lane.md)
describes the lane's command, its preload, and its memory cap.

### Page code

Page code longer than one line goes through the repo's `runInPage(view, fn, arg, schema)` helper,
never through a string passed to `view.evaluate`. The test writes the page code as a real function,
so the type checker and the linter check it. The helper sends the function's source with a JSON
argument and parses the result with the zod schema, with no cast. The parse also fails a result that
JSON cannot carry, such as a `Blob`, which arrives as `{}`. The function sees only its argument and
the page's globals, so a test variable used in its body passes the type check and throws a
`ReferenceError` in the page. A one-line `view.evaluate` call stays as it is.

### Time and helpers

- Every browser suite keeps the lane's default timeout, the 10 s limit that
  [Lanes](../SKILL.md#lanes) states. No browser test takes the disable comment that
  [A test over its limit](../SKILL.md#a-test-over-its-limit) describes.
- When a browser test runs longer, find the cause in the [Slow tests](../SKILL.md#slow-tests) table
  and fix that. The usual causes are a dev server or a build per test, which moves to the lane's
  command; a fixed wait, which becomes a wait for the element or the event; and a test that drives a
  whole user flow, which becomes a test of one component or page.
- A journey through the client's routes stays a browser suite, so that it keeps the one setup. A
  journey of the built product, through its bundle or binary, belongs in `e2e/`, as
  [Where a test lives](../SKILL.md#where-a-test-lives) describes.
- Every browser helper keeps its own test file, with no exception: the preload, `runInPage` in
  `run-in-page.browser.test.ts`, and each helper that opens a view. The preload's test also checks
  its check of the build.
- Every other test stays out of a browser suite, so the unit run keeps its speed.

## Stateful stand-ins

A program that the repo starts in another process and drives over its own protocol, such as a
worker, a language server, or a sandboxed guest, gets a stateful stand-in for the host's tests. The
stand-in speaks the real messages over the real framing, keeps the state the program keeps, and
answers from that state. A test shapes the state through the stand-in's methods and drives the host
through its real code. The program's own suite runs the real program, so the host's tests start no
process.

A scripted stand-in answers each message with whatever the test wrote for it. Each test then
describes the program's behaviour again, and the stand-in accepts a message the real program
refuses, so a host bug passes. When test after test scripts the same stand-in, give it state.

In this made-up example, a build host sends jobs to a worker process that keeps a cache of
checked-out repositories. A host that skips the checkout for a repository the worker evicted gets
the refusal the real worker sends:

```ts
test('it checks a repository out again after the worker evicts it', async () => {
  const ctx = await setupTest(); // the build host on the stub worker

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

A scripted worker answers the second `build` with the answer its script holds, so a host that never
sends the second `checkout` still passes. The stateful worker holds no checkout for `acme/api` after
the eviction, refuses the `build`, and fails the test.

The stand-in follows the stand-in rules in [Test data](../SKILL.md#test-data): it lives in the
shared test utils, takes a stand-in's file name, and has its own tests. Each of those tests pins one
behaviour the stand-in copies from the real program, such as the refusal for an evicted repository.

## Program-fixed paths and global resources

Kernel or program contracts may impose a path inside the test environment, such as a certificate
trust directory, procfs, or a VM mount point. State which contract fixes it. Use a fresh test-owned
namespace or resource with checked ownership; choose a disposable environment when ownership cannot
be guaranteed. Each test creates fresh scenario resources and cleans them up.

Distinct names for machine-global resources allocate a namespace, like `mkdtemp`; they never replace
row or store isolation. Refuse collisions with resources this run does not own before overwriting,
truncating, mounting, or deleting them. Register cleanup immediately after successful acquisition,
and release only what this run acquired. A generated name is not proof of ownership. Cleanup remains
safe after partial failure, interruption, and explicit shutdown.

## Rust lanes

A Rust crate runs the [lanes](../SKILL.md#lanes) through cargo-nextest, with the same limits. A test
path prefix names the lane, such as `e2e::` or `host::`, the way a directory or a file suffix does
for Bun. The repo's `.config/nextest.toml` holds the lanes, in this made-up example:

```toml
[profile.default]
slow-timeout = { period = "5s", terminate-after = 1 }
default-filter = "not (test(/^e2e::/) | test(/^host::/))"

[profile.e2e]
default-filter = "test(/^e2e::/)"

[[profile.e2e.overrides]]
filter = "test(/^e2e::/)"
slow-timeout = { period = "15s", terminate-after = 1 }
```

- The default profile is the unit run. Its `slow-timeout` ends a test at the 5 s limit, and its
  `default-filter` leaves out every lane prefix.
- Each lane has one profile, which inherits from `default`. It sets its own `default-filter` to the
  lane prefix, and an override sets the lane's limit. The lane's command is
  `cargo nextest run --profile <lane>`.
- A test over its limit gets its own override, with a comment that gives the measured time and the
  ticket or the floor. It goes before the lane's override, because nextest applies the first
  override that matches.
- `#[ignore]` never marks a lane test. An ignored test runs in no profile unless a flag asks for it,
  so a lane hidden behind it stops running unseen.
