# Slow tests

A test finishes in under 5 s on CI. A slow test costs every later run its full time, and a raised
timeout or a sleep hides that cost without removing it. `zgeoff/max-test-timeout` refuses a timeout
above the limit of the file's lane, and `zgeoff/no-test-sleep` refuses a fixed sleep. When a test is
slow, find its cause in this table and make the change it names. Never raise the timeout first.

| The test                                                                                    | The cause                           | The fix                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| starts the app, a server or a CLI to call it                                                | a real process start                | Call the code in the test process: its handler, an in-memory RPC link, or an injected transport. Start a real process only in `e2e/`, from the bundle built once per run, for the jobs [Where a test lives](../SKILL.md#where-a-test-lives) names.                     |
| waits for a deadline, an idle limit or a retry delay                                        | a real timer or deadline            | Make the deadline an option of the code that owns it, pass a short one, and wait on the event that the deadline causes. A runtime or kernel timer gets the shortest faithful value, as [Native timers](./system-tests.md#native-timers-and-scenario-delays) describes. |
| sleeps to let something settle                                                              | no signal to wait on                | Wait on a condition with the repo's `waitFor` helper. When the code offers nothing to wait on, add an event, a log marker or a state flag.                                                                                                                             |
| proves that something does not happen                                                       | it waits out a timeout              | Wait for a later event that shows the thing did not happen.                                                                                                                                                                                                            |
| migrates a database or builds a bundle                                                      | a shared fixture build              | Use a [per-run template](#per-run-templates), built once per run and copied per test.                                                                                                                                                                                  |
| drives a program the repo starts, such as a guest, a worker or a VM manager                 | a real process start                | Use the program's stateful stand-in from the repo's project-testing skill. When none exists, write one, as [Stateful stand-ins](./system-tests.md#stateful-stand-ins) describes.                                                                                       |
| needs the real system, and the real system is the contract                                  | a VM, the kernel, a browser, an API | Put it in a [lane](#lanes). Its directory or file suffix names the lane.                                                                                                                                                                                               |
| runs a linter or checker binary over text the code builds, such as a generated shell script | a real process start                | It is not a test. Export the text and check it in a static check script that runs in the CI static job and before a push.                                                                                                                                              |

The limits are CI rules, because a host that swaps or shares its cores runs the same test slower. A
test script and the repo's Bun config never raise a lane's default timeout above its limit, and one
test that cannot fit carries the disable comment that
[A test over its limit](#a-test-over-its-limit) describes. The pre-push hook runs only the unit
tests beside the files a branch changes, and every lane runs only in CI, as the
[pre-push baseline](https://github.com/zgeoff/tools/blob/main/docs/architecture/pre-push-baseline.md#the-related-tests)
describes.

## Per-run fixtures and lanes

A real system that starts fast and isolates per test is a per-run fixture in the unit run, not a
lane. An in-memory store, a database template copied per test, and a stand-in daemon that starts in
milliseconds are per-run fixtures. A lane exists only for a real system that the unit run cannot
host, such as a VM, the kernel or root, a browser, a container image, the Agent SDK subprocess, or a
live API, or for a test of the process itself.

## Per-run templates

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

[Database testing](./database.md) describes the template for each engine.

## Lanes

A lane runs the tests that need one real system. Each lane has its own `test:<lane>` script and a
per-test limit, which the script's `--timeout` sets and `zgeoff/max-test-timeout` checks in each
lane file. The unit run and the pre-push hook leave the lane files out by pattern. The
[ci-design](../../ci-design/SKILL.md) skill decides where CI runs each lane.

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
[Rust lanes](./system-tests.md#rust-lanes) describes.

## A test over its limit

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
