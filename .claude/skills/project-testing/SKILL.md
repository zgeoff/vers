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
- When cloned test databases pile up in the test container, check that each worker's test preload
  still calls
  [`removeOrphanedClones`](../../../libs/data/db/src/test-support/remove-orphaned-clones.ts). It
  drops the clones of test runs that have ended.

## Stored state

Check the rows below through the read functions in the folder this table names. The activity
service, the replay service and `@vers/db` all write these tables, so the table picks the one module
whose read functions a test calls.

| Rows                                              | Test package           | Folder of read functions                                                 |
| ------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `status` and `parkedFrom` of `activities`         | any                    | [`libs/data/db/src/`](../../../libs/data/db/src/read-activity-status.ts) |
| every other `activities` column, `activityChains` | `@vers/service-replay` | [`services/replay/src/queue/`](../../../services/replay/src/queue/)      |
| `avatars`, `avatarItems`, `avatarGrants`          | `@vers/service-replay` | [`services/replay/src/apply/`](../../../services/replay/src/apply/)      |

- Find a read function as a `read-*.ts` file in its folder. When none returns the column you check,
  add one to that folder, with a test.
- Use the status read function from any package. Every status move goes through the
  [transition writer](../../../libs/data/db/src/transition-activity-status.ts) beside it in
  `@vers/db`.
- In `@vers/service-activity`, `src/handlers/` writes every table its tests check, so those tests
  read through the handlers.

## Real-database services

- Copy the test files of [`services/avatar`](../../../services/avatar/) for a new service: its
  service test, its router test and its access tests.
- Name the service test `create-<service>-service.test.ts`. In it, drive one write through an
  injected database, and read the row back from that database through a read function in the
  service's `src/handlers/`. Also create the service with no database injected, so it reads
  `env.DATABASE_URL`, and dispose of each service you create.
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
  `bun:test`, so lint never checks a Playwright timeout.
- Set the `timeout` in each `playwright*.config.ts` to twice the slowest test in the last 5 green CI
  runs, rounded up to a whole second. The `list` reporter prints each test's time in the CI log.
- When one test runs far slower than the rest, remove each fixed wait in it, or wait on a condition.
  When it is still slow, give that test its own `test.setTimeout`, with its measured time in a
  comment. Never raise the config's timeout for one slow test.
