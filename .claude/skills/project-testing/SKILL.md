---
name: project-testing
description:
  "vers's test facts and its own test topics beside the shared testing skill: the run mode, the read
  functions a test checks stored rows through, the real-database service suites, idle-core entities,
  the web app's router, request-context and form helpers, world-map scenes, and the Playwright
  timeouts. Load it beside testing before you design, write or review a vers test."
metadata:
  kind: rule-set
---

# vers testing

## Facts

| Fact       | Where                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Lanes      | the e2e lane: [`apps/web-e2e/`](../../../apps/web-e2e/), with each limit in the `timeout` of a `playwright*.config.ts` |
| Test utils | the packages under [`libs/testing/`](../../../libs/testing/), then the package's own `src/test-utils/`                 |

## Departures

- Run each package's tests with plain `bun test --randomize`, in one process. The run-mode rule in
  [testing](../testing/SKILL.md) passes `--parallel=<N> --no-isolate` instead. Turbo runs four
  packages at once in CI, and plain mode uses the least memory. The comment above the Unit Tests
  step in [`pr.yml`](../../../.github/workflows/pr.yml) gives the times.

## The run mode

- Make each suite pass at `bun test --parallel=4 --no-isolate` too, so a package can switch modes
  without a rewrite. Run that mode once before you hand off a new suite.
- Find the sweep that drops the clones of ended runs in
  [`removeOrphanedClones`](../../../libs/data/db/src/test-support/remove-orphaned-clones.ts). Each
  worker's test preload runs it at start.

## Stored state

Read a stored row through the module that creates it, by the
[Stored state](../testing/SKILL.md#stored-state) rule in testing. Several vers modules write
`activities`, `activityChains`, `avatars`, `avatarItems` and `avatarGrants`, so pick the read
functions for those tables by the package your test is in:

- In `@vers/service-activity`, read `activities` and `activityChains` directly, `status` included.
  Its `src/handlers/` creates those rows and picks each status move, so its tests are that module's
  own tests.
- In `@vers/service-activity`, read `avatars` directly too. The replay service depends on
  `@vers/service-activity`, so an import of the replay read functions makes a cycle.
- In every other package, read the `status` and `parkedFrom` of an `activities` row with
  [`readActivityStatus`](../../../libs/data/db/src/read-activity-status.ts) from `@vers/db`. Every
  status move runs through the transition writer beside it, whichever service picks the move.
- In `@vers/service-replay`, read the other `activities` columns, and `activityChains`, with the
  `read-*.ts` files in [`src/queue/`](../../../services/replay/src/queue/).
- In `@vers/service-replay`, read `avatars`, `avatarItems` and `avatarGrants` with the `read-*.ts`
  files in [`src/apply/`](../../../services/replay/src/apply/).
- In a `lib`, such as `@vers/scripts`, read the other `activities` columns through a read function
  in [`libs/data/db/src/`](../../../libs/data/db/src/). Boundaries bar a `lib` from importing a
  service. Read a column that the lib's own code writes, such as `archivedAt` in `@vers/scripts`,
  directly in the tests of that code.
- In any other service, read the other columns through the module that creates the rows.

When the folder you read through has no read function for the column you check, add one to it, with
a test.

## Real-database services

- Copy the test files of [`services/avatar`](../../../services/avatar/) for a new service: its
  service test, its router test and its access tests.
- Name the service test `create-<service>-service.test.ts`. In it, drive one write through an
  injected database, and read the row back from that database through a read function in the
  service's `src/handlers/`. When the write's result already holds the row's fields, check the
  result instead, as the [Stored state](../testing/SKILL.md#stored-state) rule in testing allows.
  Also create the service with no database injected, so it reads `env.DATABASE_URL`, and dispose of
  each service you create.
- Check that a stop destroys the database the service built with `spyOn(db, 'destroy')`. A query
  after the stop proves nothing. Kysely opens the pool again for it.
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
