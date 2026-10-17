# System tests

These rules cover the tests that run a whole program or reach the host: end-to-end journeys,
evaluation suites, property tests, native timers, real network stand-ins, and resources the host
fixes. The [testing skill](../SKILL.md) rules apply throughout, and each section here names the one
it relaxes.

- [End-to-end suites](#end-to-end-suites)
- [Evaluation suites](#evaluation-suites)
- [Property tests](#property-tests)
- [Native timers and scenario delays](#native-timers-and-scenario-delays)
- [Real applications and transport](#real-applications-and-transport)
- [Program-fixed paths and global resources](#program-fixed-paths-and-global-resources)

## End-to-end suites

An end-to-end suite splits by user journey, one file per journey: `e2e/tui-spawn.test.ts` beside
`e2e/tui-attach.test.ts`. A journey test may chain dependent act-and-assert phases, because each
step of the journey needs the state that the step before it left. Ordinary tests outside `e2e/` act
once. Generated sequences follow [Property tests](#property-tests).

An outer harness may reuse expensive hosts, services, and immutable fixture inputs across journeys.
Each journey keeps its own file, setup, scenario, and cleanup. Reset shared infrastructure to a
clean baseline before each journey; test that the reset removes dirty state, including after failure
or interruption. Recreate the environment when a reset cannot restore the baseline. The harness owns
infrastructure startup and shutdown; test files keep the hook rules in
[Setup and cleanup](../SKILL.md#setup-and-cleanup).

Keep command construction importable. Test argument and flag-position cases through the real parser
in module tests; keep binary journeys that check the assembled program.

## Evaluation suites

An evaluation suite in `evals/` checks production code against a committed corpus or report: it
replays a corpus of recorded traffic through the production path, or checks a committed evaluation
report against the code. It tests a corpus, not one module, so it has no module to sit beside.

- The input is the committed corpus or report file, read through one tested loader. The cases are
  never restated as inline literals.
- Helpers live in `evals/test-utils/` with tests of their own. A stand-in replaces only what a
  recording cannot reproduce, such as the disk or the forge, and the suite injects it into the
  production path.
- A deliberate mismatch between the report and the code fails the suite. A suite that passes on a
  stale report checks nothing.
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
when the runtime cannot expose a shorter faithful deadline, and run that case through an explicit
script.

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
