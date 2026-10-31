# Time and waiting

Control time in the most explicit form the code allows:

1. **A time argument.** Code that advances through time takes the duration or the timestamp as a
   parameter: `scheduler.advance(30_000)`.
2. **An injected clock.** Code with its own loop or timers takes a `now` function or a clock object,
   and the test steps it.
3. **Fake timers.** Code the repo does not own, such as a third-party library, gets
   `setSystemTime()` and fake timers. The test restores them in `onTestFinished`.

A Claude Code mod reads the wall clock and never the host's clock, for the reason in
[Claude Code mod checks](./claude-code-mods.md#time).

A value that depends on the wall clock is built relative to `Date.now()`
(`expiresAt: new Date(Date.now() - 1000)`) and asserted with range matchers such as `toBeAfter` and
`toBeWithin`, never with an exact timestamp.

A test waits on a condition with a polling `waitFor`, never with a sleep. A sleep makes the suite
slower by its full length on every run, and it still fails on a slow machine. When the code offers
nothing observable to wait on, the code lacks a signal: add one, such as an event, a log marker, or
a state flag, and wait on that.

A timer that no clock or argument from the test reaches, and a delay the test adds on purpose,
follow [System tests](./system-tests.md#native-timers-and-scenario-delays).
