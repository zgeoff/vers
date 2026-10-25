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
the web app, and real-database services on Postgres. This skill points at the vers utilities that
implement the shared rules and adds the rules that only vers code needs. It adds and tightens rules;
it never relaxes one from the shared skill.

## Key rules

- [Utilities](#utilities): search the `libs/testing/` packages for a helper before writing one.
- [Services](#services): hold a single-row invariant in one statement, and give every service its
  two scaffolding suites.
- [The idle-core construction ladder](#the-idle-core-construction-ladder): build entities inline
  with the fixed ladder, only as far as the test needs.
- [The web app](#the-web-app): mount through the router and request-context helpers, and cover a
  form's result mapping with a hand-built `lastResult`.
- [Lanes](#lanes): every `bun test` file runs in the unit lane, the Playwright suites run outside
  `bun test`, and each Playwright config sets its test timeout from measured CI durations.
- [Test mode](#test-mode): each package runs `bun test --randomize`, and a preload starts per-file
  state in a `beforeAll`.

## Utilities

The vers test utilities live in the packages under [`libs/testing/`](../../../libs/testing/), one
export per file, and each package's `index.ts` lists what it exports. Search there before writing a
helper.

- **Real-database services** take their Postgres handle from
  [`createTestDB`](../../../libs/testing/service-test-utils/src/bun/create-test-db.ts) and their
  service-to-service actors from
  [`createViewer`](../../../libs/testing/service-test-utils/src/bun/composites/create-viewer.ts) and
  [`createAnonymousViewer`](../../../libs/testing/service-test-utils/src/bun/composites/create-anonymous-viewer.ts),
  all from `@vers/service-test-utils/bun`. Service tokens on the real verification path come from
  [`resolveTestServiceKeyPair`](../../../libs/testing/service-test-utils/src/bun/resolve-test-service-key-pair.ts)
  with
  [`createServiceToken`](../../../libs/testing/service-test-utils/src/bun/create-service-token.ts).
- **A typed RPC client over a service app** is
  [`buildRPCTestClient`](../../../libs/testing/test-utils/src/build-rpc-test-client.ts)`(app, { token })`
  from `@vers/test-utils`, which also holds the polling wait outside React,
  [`waitFor`](../../../libs/testing/test-utils/src/wait-for.ts), and the generated conformance
  cases,
  [`collectConformanceCases`](../../../libs/testing/test-utils/src/collect-conformance-cases.ts)`(contract, …)`.
- **Per-test env overrides** go through
  [`updateEnv`](../../../libs/testing/test-utils/src/bun/update-env.ts) from `@vers/test-utils/bun`,
  restored by
  [`registerBunTestCleanup`](../../../libs/testing/test-utils/src/bun/register-bun-test-cleanup.ts)`()`
  in the preload. The same entry point holds the MSW lifecycle,
  [`registerMSWLifecycle`](../../../libs/testing/test-utils/src/bun/register-msw-lifecycle.ts)`(server)`,
  which defaults to `onUnhandledRequest: 'error'`, and the counter assertions'
  [`createInMemoryMetrics`](../../../libs/testing/test-utils/src/bun/create-in-memory-metrics.ts)`()`.
- **Stateful service mocks** are the `build<Service>MockHandlers` functions in
  [`@vers/mock-services`](../../../libs/testing/mock-services/src/), one folder per service, over
  its `@msw/data` collections.
- **Client tests** take per-test oRPC handlers from
  [`buildMockService`](../../../libs/testing/client-test-utils/src/orpc/build-mock-service.ts) in
  `@vers/client-test-utils/orpc`, and reset Zustand stores with
  [`registerZustandReset`](../../../libs/testing/client-test-utils/src/register-zustand-reset.ts)`()`
  from `@vers/client-test-utils`, in the preload.

[`services/avatar`](../../../services/avatar/) is the reference real-database service: its suites
show the factory, the setup, the scaffolding suites, and the access pairs below.

## Services

- **Transactions.** A conditional `UPDATE` or `DELETE … RETURNING`, an `INSERT … ON CONFLICT`, or a
  data-modifying CTE holds a single-row invariant in one statement, and it leaves no open
  transaction behind when a serverless process dies. A handler opens an interactive
  `db.transaction()` only for an invariant across several rows that no single statement can hold,
  and that handler's suite takes `schema` isolation, because the default `transaction` handle cannot
  nest it.
- **Scaffolding suites.** Every service carries two suites. `create-<service>-service.test.ts`
  drives one write through an injected database and asserts the row landed in the handle, and it
  boots the service from `env.DATABASE_URL` when no database is injected, disposing each boot. The
  router's suite, beside the module that builds or creates the router, drives every case from
  `collectConformanceCases` through `await expect(conformanceCase.run(ctx.app)).toResolve()`.
- **Anonymous pairs.** A procedure that resolves the acting user carries a third access test with
  `createAnonymousViewer`. A pure service-to-service procedure carries none.

## The idle-core construction ladder

An idle-core test builds the entities it drives with a fixed ladder of calls:
[`createMockSimulationContext`](../../../libs/game/idle-core/src/test-utils/factories/create-mock-simulation-context.ts)`()`,
[`createAvatar`](../../../libs/game/idle-core/src/entities/create-avatar.ts)`(data, ctx)`,
[`createActivity`](../../../libs/game/idle-core/src/core/create-activity.ts)`(data, ctx)`, and
[`createCombatExecutor`](../../../libs/game/idle-core/src/core/create-combat-executor.ts)`(activity, avatar, ctx)`.
A test climbs only as far as the last entity it needs: an avatar test stops after `createAvatar`.
The ladder stays inline in each test, because a composite that wraps it hides the handles the test
acts on.

## The web app

- **Binding names.** A
  [`createSignedInUser`](../../../apps/web/src/test-utils/create-signed-in-user.ts)`(…)` result is
  held as `signedIn`, beside the shared `ctx`, `hook`, and `rendered`.
- **Routing.** Router-aware components mount through
  [`renderWithRouter`](../../../apps/web/src/test-utils/render-with-router.tsx), which returns the
  `router` beside the render result.
- **Request context.**
  [`withRequestContext`](../../../apps/web/src/test-utils/with-request-context.ts) is the one stub
  for ambient request context, installed in the preload behind a mutable holder. A test runs its
  render and assertions inside the callback, and awaits the call for its `{ cookies, value }` result
  or leaves it un-awaited to assert a rejection on it.

  ```tsx
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<AccountScreen />);

    expect(await rendered.findByText(signedIn.user.username)).toBeInTheDocument();
  });
  ```

- **Forms.** A form island drives its Conform form through
  [`useFormSubmit`](../../../apps/web/src/lib/forms/use-form-submit.ts). The hook takes the form's
  server function, dispatches the `FormData`, and returns `lastResult`, an in-flight flag, and the
  submit handler. Validation imports from `@conform-to/zod/v4`, and the honeypot check stays a
  server-side helper. Cover a form's mapping from result to UI by rendering it with a hand-built
  `lastResult` in the `submission.reply()` shape: a form-level message under the empty-string key,
  and a field message under the field name. This reaches every branch with no submit and no server.
  Inject an action to drive the pending state and the `Response` fallback.
- **Three scenes.** A component in
  [`components-three/`](../../../libs/game/worldmap-client/src/components-three/) renders through
  `ReactThreeTestRenderer`, fires events with `renderer.fireEvent(mesh, 'pointerEnter', …)`, and
  asserts on store state. A DOM component in
  [`components-ui/`](../../../libs/game/worldmap-client/src/components-ui/) goes through React
  Testing Library and `userEvent`.

## Lanes

vers has no project lane. Every `bun test` file runs in the unit lane at the shared skill's 5 s
limit, Postgres included: the test container with a template per branch is a per-run fixture. No
file takes a lane suffix, so the root [`.oxlintrc.json`](../../../.oxlintrc.json) sets no `lanes`
option. A new lane needs a real system that the shared skill's lane rules allow, and the pull
request that adds it declares the lane there and lists it here with its real system and its limit.

The suites in [`apps/web-e2e`](../../../apps/web-e2e/) drive the built web app in a real browser.
They run under Playwright through that package's `e2e` scripts, not `bun test`. The package name
ends in `-e2e`, so `zgeoff/max-test-timeout` puts its files in the e2e lane, whose limit is 15 s.
The rule checks only the runners imported from `bun:test`, so it sees no Playwright `test` call, no
`test.setTimeout`, and no Playwright config.

Each Playwright config, such as
[`playwright.config.ts`](../../../apps/web-e2e/playwright.config.ts), sets its test timeout from
measurement: about twice the slowest test over the last 5 green CI runs, rounded up to a whole
second. The config's `list` reporter prints every test's duration in the CI log. When one test runs
far slower than the rest, fix a fixed wait or a missing condition wait in it. If the time is real,
give that test its own `test.setTimeout` with its measured time in a comment. The config's timeout
never rises to cover one slow test.

## Test mode

Every package's `test` script runs `bun test --randomize`: one process, every file in it, no
isolation, in a random order. A file that depends on the order of the files before it fails CI, and
a new package's script takes the same flag. A failed run prints its `--seed=<n>`; pass that seed
back to reproduce the order.

The preload's resets after each test are the contract, so a suite must also pass at
`bun test --parallel=4 --no-isolate`, where each worker shares one process across its files. Under
`--parallel`, Bun runs a preload's body once per worker but fires its `beforeAll` and `afterAll`
around every file. A preload therefore starts per-file state, such as the MSW server's `listen`, in
a `beforeAll`, never in its body.

The same timing rules out a teardown in a preload's `afterAll`. A worker keeps its cloned test
databases across all its files, and each clone's name carries an owner tag, from the host name and
the pid namespace, and the owning process id. Each worker's preload drops, at start, the clones with
its own tag whose process has ended.

Turbo runs several packages at once in CI, so each package stays on plain `bun test`, the cheapest
mode in memory.

## Golden values

- A golden value — transcribed machine output no human derives by reading the code: a stream's draw
  sequence, a rolled encounter or item, a derived key, an RNG state — is asserted with
  `toMatchInlineSnapshot()`. `bun test -u` regenerates it after an intentional behavior change, and
  the regenerated diff is reviewed like any code change.
- Human-authored expectations keep explicit matchers: spec test vectors from an external authority,
  wire forms readable against their encoding, and property assertions. A snapshot there would bless
  a broken implementation's own output.
