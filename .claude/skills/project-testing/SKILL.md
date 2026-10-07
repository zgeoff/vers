---
name: project-testing
description:
  vers's own testing rules on top of the shared testing skill — the vers test utilities and where
  they live, the service scaffolding suites, transaction design for real-database services, the
  idle-core construction ladder, Conform forms, react-three scenes, and the web app's router and
  request-context helpers. Load together with the testing skill when designing, writing, or
  reviewing vers tests.
---

# vers testing

vers runs all three regimes from the shared testing skill: pure libraries, MSW-mocked clients and
the web app, and real-database services on Postgres. This skill names the vers utilities that
implement the shared rules and adds the rules that only vers code needs. It adds and tightens rules;
it never relaxes one from the shared skill.

## Utilities

| Need                                         | Utility                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A per-test Postgres handle                   | `createTestDB()` from `@vers/service-test-utils/bun`                                                        |
| Service-to-service actors                    | `createViewer` and `createAnonymousViewer` from `@vers/service-test-utils/bun`                              |
| A typed RPC client over a service app        | `buildRPCTestClient(app, { token })` from `@vers/test-utils`                                                |
| Service tokens on the real verification path | `getTestServiceKeyPair()` with `createServiceToken`                                                         |
| A polling wait outside React                 | `waitFor` from `@vers/test-utils`                                                                           |
| Per-test env overrides                       | `updateEnv` from `@vers/test-utils/bun`, restored by `registerBunTestCleanup()` in the preload              |
| The MSW lifecycle                            | `registerMSWLifecycle(server)` from `@vers/test-utils/bun`, which defaults to `onUnhandledRequest: 'error'` |
| Stateful service mocks                       | `build<Service>MockHandlers` from `@vers/mock-services`, over its `@msw/data` collections                   |
| Per-test oRPC handlers                       | `buildMockService` from `@vers/client-test-utils/orpc`                                                      |
| Zustand store resets                         | `registerZustandReset()` from `@vers/client-test-utils`, in the preload                                     |
| Counter assertions                           | `createInMemoryMetrics()` from `@vers/test-utils/bun`                                                       |
| Generated conformance cases                  | `collectConformanceCases(contract, …)` from `@vers/test-utils`                                              |

`services/avatar` is the reference real-database service: its suites show the factory, the setup,
the scaffolding suites, and the access pairs below.

## Services

- **Transactions.** A conditional `UPDATE` or `DELETE … RETURNING`, an `INSERT … ON CONFLICT`, or a
  data-modifying CTE holds a single-row invariant in one statement, and it leaves no open
  transaction behind when a serverless process dies. A handler opens an interactive
  `db.transaction()` only for an invariant across several rows that no single statement can hold,
  and that handler's suite takes `schema` isolation, because the default `transaction` handle cannot
  nest it.
- **Scaffolding suites.** Every service carries two suites. `create-<service>-service.test.ts`
  drives one write through an injected database and asserts the row landed in the handle, and it
  boots the service from `env.DATABASE_URL` when no database is injected, disposing each boot.
  `build-router.test.ts` drives every case from `collectConformanceCases` through
  `await expect(conformanceCase.run(ctx.app)).toResolve()`.
- **Anonymous pairs.** A procedure that resolves the acting user carries a third access test with
  `createAnonymousViewer`. A pure service-to-service procedure carries none.

## The idle-core construction ladder

An idle-core test builds the entities it drives with a fixed ladder of calls:
`createMockSimulationContext()`, `createAvatar(data, ctx)`, `createActivity(data, ctx)`, and
`createCombatExecutor(activity, avatar, ctx)`. A test climbs only as far as the last entity it
needs: an avatar test stops after `createAvatar`. The ladder stays inline in each test, because a
composite that wraps it hides the handles the test acts on.

## The web app

- **Binding names.** A `createSignedInUser(…)` result is held as `signedIn`, beside the shared
  `ctx`, `hook`, and `rendered`.
- **Routing.** Router-aware components mount through `renderWithRouter`, which returns the `router`
  beside the render result.
- **Request context.** `withRequestContext` is the one stub for ambient request context, installed
  in the preload behind a mutable holder. A test runs its render and assertions inside the callback,
  and awaits the call for its `{ cookies, value }` result or leaves it un-awaited to assert a
  rejection on it.

  ```tsx
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<AccountScreen />);

    expect(await rendered.findByText(signedIn.username)).toBeInTheDocument();
  });
  ```

- **Forms.** A form island drives its Conform form through `useFormSubmit` in `lib/forms/`. The hook
  takes the form's server function, dispatches the `FormData`, and returns `lastResult`, an
  in-flight flag, and the submit handler. Validation imports from `@conform-to/zod/v4`, and the
  honeypot check stays a server-side helper. Cover a form's mapping from result to UI by rendering
  it with a hand-built `lastResult` in the `submission.reply()` shape: a form-level message under
  the empty-string key, and a field message under the field name. This reaches every branch with no
  submit and no server. Inject an action to drive the pending state and the `Response` fallback.
- **Three scenes.** A component in `components-three/` renders through `ReactThreeTestRenderer`,
  fires events with `renderer.fireEvent(mesh, 'pointerEnter', …)`, and asserts on store state. A DOM
  component in `components-ui/` goes through React Testing Library and `userEvent`.
