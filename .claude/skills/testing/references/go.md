# Go testing

Go tests use the standard `testing` runner. Preserve the shared
[behavioral principles](../SKILL.md#principles) with native names, subtests, assertions, and
cleanup. The Bun-specific spelling and mechanisms do not apply.

## Cases and data

- Keep tests beside their package in `_test.go` files. Use behavioral `TestXxx` names and named
  `t.Run` subtests for closed decision tables. Each row creates its own state; a parent test never
  supplies mutable scenario state to its children.
- Keep the selected scenario visible in the case. Immutable infrastructure definitions can be
  shared. An assertion guard such as `if got != want { t.Errorf(...) }` checks an outcome; it does
  not select a scenario.
- Keep package-local helpers in `_test.go` files. A helper that models behavior or dependency
  assumptions needs tests. Utilities shared across packages use a test-support package; no
  one-function-per-file rule applies.
- Generated cases retain the independent-contract, case-isolation, and replay rules in
  [property tests](../SKILL.md#property-tests). Use the native fuzzer or a property library
  appropriate to the generated inputs; adopting fast-check is not a Go requirement.

## Assertions

Use `gotest.tools/v3/assert` when the project selects that assertion library. `Equal` uses `==`;
`DeepEqual` uses go-cmp for whole-value comparisons. Keep independent observations in separate
calls. Equality options reflect the contract, never hide unwanted fields or equate values that the
contract distinguishes.

Use `NilError` for a successful operation and `ErrorIs` for a sentinel or wrapped error contract.
Use `errors.As` when the error type and its fields matter. Match exact text only when the text is
contract. `Check` reports a failure and permits later independent checks; fatal checks stop the
current test.

Fatal assertions run on the test goroutine. Capture worker outcomes through channels or joined
tasks, then assert after completion. A callback that might never run is not the only place an
assertion can live.

## Resources and concurrency

- Register `t.Cleanup` immediately after a successful acquisition. Use `t.TempDir` for temporary
  trees and `t.Setenv` for scoped environment changes. Cleanup uses captured handles and paths,
  releases only acquired resources, and joins background goroutines.
- Mark helpers with `t.Helper` so failures identify the calling case. A shared fixture utility can
  register cleanup through the case's `testing.T`.
- Use `t.Parallel` only when cases own their state. Environment changes through `t.Setenv` cannot
  run in parallel tests or tests with parallel ancestors. Do not use unique entity keys to hide a
  shared-state gap.

## Time and real boundaries

Use a time argument or injected clock for policy logic. Evaluate `testing/synctest` for supported
in-process timer and concurrency tests: it runs those goroutines with an isolated fake clock.
Fake-clock sleeps advance simulated time; they are not real readiness delays. Real network I/O,
external processes, and kernel operations need separate real-boundary coverage and observable
completion signals.

Use real temporary files, isolated databases, `httptest` servers, sockets, and processes where the
behavior depends on them. Stand-ins take typed request and response shapes from the real contract
and use isolated native stores for rich state. MSW and `@msw/data` are Bun/frontend mechanisms, not
Go requirements. Follow the shared [native-timer](../SKILL.md#native-timers-and-scenario-delays) and
[resource ownership](../SKILL.md#program-fixed-paths-and-global-resources) rules.

## Reports

A project that selects gotestsum runs it over the existing `go test` flags, including race checks.
Preserve its JSON results for timing comparisons and print the slowest cases. Retries or automatic
skips are not a reporting feature to enable during alignment. Pin tools and libraries through the
project's dependency mechanism.

Native APIs: [Go testing](https://pkg.go.dev/testing),
[named subtests](https://go.dev/blog/subtests), and
[testing/synctest](https://pkg.go.dev/testing/synctest). Tool APIs:
[gotest.tools assertions](https://pkg.go.dev/gotest.tools/v3/assert) and
[gotestsum](https://github.com/gotestyourself/gotestsum).
