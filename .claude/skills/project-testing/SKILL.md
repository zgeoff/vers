---
name: project-testing
description:
  "vers's test facts and its own test topics beside the shared testing skill: the run mode, the
  real-database service suites, idle-core entities, the web app's router, request-context and form
  helpers, world-map scenes, and the Playwright timeouts. Load it beside testing before you design,
  write or review a vers test."
metadata:
  kind: rule-set
---

# vers testing

## Facts

| Fact       | Where                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Lanes      | none                                                                                                   |
| Test utils | the packages under [`libs/testing/`](../../../libs/testing/), then the package's own `src/test-utils/` |

## Departures

- Run each package's tests with plain `bun test --randomize`, in one process. The run-mode rule in
  [testing](../testing/SKILL.md) passes `--parallel=<N> --no-isolate` instead. Turbo runs four
  packages at once in CI, and plain mode uses the least memory. The comment above the Unit Tests
  step in [`pr.yml`](../../../.github/workflows/pr.yml) gives the times.

## The run mode

- Make each suite pass at `bun test --parallel=4 --no-isolate` too, so a package can switch modes
  without a rewrite. Run that mode once before you hand off a new suite.
- Write no cleanup for a per-worker test database cloned from the template. At start, each worker's
  test preload runs
  [`removeOrphanedClones`](../../../libs/data/db/src/test-support/remove-orphaned-clones.ts), which
  drops the clones left by ended processes. A drop in an `afterAll` would break the next file in the
  same worker.

## Real-database services

- Copy the test files of [`services/avatar`](../../../services/avatar/) for a new service: its
  service test, its router test and its access tests.
- Name the service test `create-<service>-service.test.ts`. In it, drive one write through an
  injected database and read the row back through the same database. Also create the service with no
  database injected, so it reads `env.DATABASE_URL`, and dispose of each service you create.
- Put the router test beside the module that builds the router, such as
  `create-avatar-router.test.ts`. Run every case from
  [`collectConformanceCases`](../../../libs/testing/test-utils/src/collect-conformance-cases.ts)
  through `await expect(conformanceCase.run(ctx.app)).toResolve()`, with `ctx` from the file's
  `setupTest()`.
- Add an anonymous test, built with
  [`createAnonymousViewer`](../../../libs/testing/service-test-utils/src/bun/composites/create-anonymous-viewer.ts),
  to a procedure that reads the acting user. It sits beside the allowed and refused tests that
  testing asks for. A procedure that only another service calls needs no anonymous test.
- In the replay service, test the order in which the verifier settles one avatar's activities
  through
  [`runSettlementSequence`](../../../services/replay/src/test-utils/settlement-model/run-settlement-sequence.ts).
  It drives a list of lifecycle commands through the real activity handlers and the real verifier,
  and checks each step against a reference model. When its fast-check suite shrinks a
  counterexample, paste the case into a named test in `run-settlement-sequence.test.ts`.

## Idle-core entities

Build the entities an idle-core test drives with these calls, in this order, inline in each test:

1. [`createMockSimulationContext`](../../../libs/game/idle-core/src/test-utils/factories/create-mock-simulation-context.ts)`()`
2. [`createAvatar`](../../../libs/game/idle-core/src/entities/create-avatar.ts)`(data, ctx)`
3. [`createActivity`](../../../libs/game/idle-core/src/core/create-activity.ts)`(data, ctx)`
4. [`createCombatExecutor`](../../../libs/game/idle-core/src/core/create-combat-executor.ts)`(activity, avatar, ctx)`

Stop at the last entity the test needs: an avatar test stops after `createAvatar`. Never wrap the
calls in one helper. A helper hides the values the test acts on.

## The web app

- Name a [`createSignedInUser`](../../../apps/web/src/test-utils/create-signed-in-user.ts) result
  `signedIn`.
- Mount a component that reads the router through
  [`renderWithRouter`](../../../apps/web/src/test-utils/render-with-router.tsx). It returns the
  `router` beside the render result.
- Stub the request context only through
  [`withRequestContext`](../../../apps/web/src/test-utils/with-request-context.ts), which the
  preload installs. Run the render and the assertions inside its callback. To read the
  `{ cookies, value }` result, await the call. To assert a rejection, pass the unawaited call to
  `expect(…).rejects`.

  ```tsx
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<AccountScreen />);

    expect(await rendered.findByText(signedIn.user.username)).toBeInTheDocument();
  });
  ```

- Test a form through the `lastResult` that
  [`useFormSubmit`](../../../apps/web/src/lib/forms/use-form-submit.ts) takes. Render the form with
  a hand-built `lastResult` in the shape of Conform's `submission.reply()`: a form-level message
  under the empty-string key, and a field message under the field name. That reaches each branch
  with no submit and no server.
- Pass the form a stub action that never resolves to test the pending state. Pass one that returns a
  `Response` to test the generic error the hook shows for it.

## World-map scenes

- Render a component in
  [`components-three/`](../../../libs/game/worldmap-client/src/components-three/) through
  `ReactThreeTestRenderer` from `@react-three/test-renderer`, fire events with
  `renderer.fireEvent(mesh, 'pointerEnter', …)`, and assert on store state.

## Playwright timeouts

- Run the suites in [`apps/web-e2e/`](../../../apps/web-e2e/) through that package's `e2e` scripts,
  never `bun test`. The lint rule `zgeoff/max-test-timeout` checks only tests that import from
  `bun:test`, so no lint checks a Playwright timeout.
- Set the `timeout` in each `playwright*.config.ts` to twice the slowest test in the last 5 green CI
  runs, rounded up to a whole second. The `list` reporter prints each test's time in the CI log.
- When one test runs far slower than the rest, remove each fixed wait in it, or wait on a condition.
  When it is still slow, give that test its own `test.setTimeout`, with its measured time in a
  comment. Never raise the config's timeout for one slow test.
