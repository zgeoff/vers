---
name: testing
description:
  vers testing conventions — the three regimes by package kind, the no-mock / no-branching /
  co-location rules, `bun test` process-wide lifecycle, isolation levels, factories and composites,
  jest-extended matchers, authorisation pairs, time and timestamp rules, forced infrastructure
  failures, golden values and determinism, observability harnesses, contract-schema idioms, and the
  MSW / RSC / Forms / real-database specifics. Load when designing, writing, or reviewing tests.
---

# Testing

`bun test` runs every file in one process with no per-file isolation — lean into it: lifecycle and
cleanup register once in a package's `bunfig.toml` preload and apply process-wide, and test files
contain no `beforeAll`/`beforeEach`/`afterEach`/`afterAll`. Three regimes cover the workspace, by
package kind:

- **Pure packages** — libs and CLIs with no service or database edge. Mock-free: pure modules assert
  on return values, file-touching ones use `mkdtemp` trees, and CLI behaviour is asserted end-to-end
  by spawning the real binary — a module hard to test without mocking moves its I/O to the caller.
- **MSW-mocked packages** — clients of mocked services and app-web.
- **Real-database packages** — services, apps, and DB-backed libraries exercising a real postgres.

## Principles

The rules below decide most situations; where they don't, these do:

- Clarity over abstraction: repetition in a test isn't a smell, hidden setup is.
- Isolation is non-negotiable: every test passes alone and in any order.
- Test behaviour, not implementation: a refactor that preserves the observable contract — renaming a
  private helper, restructuring a loop — breaks no test.
- Every mock is a divergence from reality: mock only what is genuinely out of reach, and keep it
  high-fidelity — correct codes, realistic shapes, shared types.
- Test utilities are production code: anything a test file would grow beyond a local `setupTest()`
  moves to `test-utils/` with its own test, or it doesn't exist — an untested helper inside a test
  file can be wrong in a way no test reports.
- Assertions are the contract: one loose assertion makes the rest of the test theatre.

## Everywhere

- Never use `describe` — write flat `test(…)` blocks with behavioural titles that start with "it"
  (`test('it pads before a return statement', …)`).
- A test body arranges, acts, asserts — phases separated by blank lines, never `// arrange`
  comments; the act is usually a single call. A body with two act-assert pairs is two tests. A
  pure-function test may collapse all three onto one expression.
- `test.each` is sanctioned only for a closed decision table — data-only rows and a title template
  that starts with "it" and interpolates the distinguishing input
  (`test.each(rows)('it picks %s when the action is %s', …)`). Anything else is one `test()` per
  case.
- A loop over a module's own exports proving registry completeness (`Object.keys(generators)`) is
  sanctioned iteration, not test branching — but the loop must not re-implement the transformation
  it checks.
- An assertion inside a callback the unit may never invoke passes vacuously when the callback is
  skipped — capture into a const outside the scope and assert after the callback returns.
- Test files are co-located with the module they test (`parse-source.ts` beside
  `parse-source.test.ts`) — no `test/`, `tests/` or `__tests__` directories. Declaration emit
  excludes `*.test.ts`, so they never ship.
- A test whose unit consumes a domain object or DTO takes it from the package's faker-defaulted
  `create-mock-*` factory in `test-utils/factories/` (each factory has its own test), overriding
  only the fields the unit reads. Extraction follows where the type lives, not how many tests use
  it: a type that crosses module boundaries gets its factory immediately; a type local to the module
  under test stays an inline literal. Defaults are faker-dynamic where the value is arbitrary —
  proving the unit doesn't depend on specific data — and static only for a constrained field (an
  enum, a discriminator) or throughout a deterministic engine package, where a faker value would
  churn every golden snapshot. The factory's own test pair keeps fixed titles —
  `it builds a default X` asserting the whole shape with `toStrictEqual` plus asymmetric matchers,
  and `it applies overrides on top of the defaults`; it may additionally round-trip the contract
  schema, never instead. A factory defaults every foreign key to a freshly generated id
  (`createId()`), never a real parent's — parent wiring is a composite's job. A row factory returns
  the table's `Insertable<…>`; a DTO factory returns the contract type — distinct artefacts in the
  packages that own each shape.
- A unit that parses or validates raw input — a zod schema, a decoder — is tested with inline
  literal payloads, valid and invalid, never factory output: a factory built to satisfy a schema
  cannot falsify it. A rejection test asserts the reported issue path, never bare `success: false` —
  a payload invalid for any reason passes the bare boolean.
- An input that is neither a domain object nor a DTO — a plain argument, an options bag, a config —
  is written inline at the call site, even when tests repeat the literal; repeated data reads, an
  opaque baseline doesn't.
- A test file declares no function other than a local `setupTest()`, and no module-level fixture or
  baseline shared between tests. Any other helper — a data or baseline builder, an assertion
  wrapper, a render or mount wrapper — is inlined at the call site, replaced by a registered matcher,
  or extracted to `test-utils/` with its own test; shared data is written inline at each call site,
  not hoisted to a module const. A shared mount
  goes through the project render utils (`render`/`renderHook`), never a per-file `render<Thing>`; a
  hook whose reactive input changes between renders is driven by a closure over a mutable local
  re-passed to the project `renderHook` with a no-arg `hook.rerender()`, not a bespoke wrapper that
  reaches for RTL `initialProps`.
- A factory is called in the test that uses its value, never through a helper that pre-configures
  overrides — a second layer of defaults is a shadow factory the test site can't see.
- `test-utils/factories/` holds only faker-defaulted plain-data `create-mock-*` factories. Runtime
  stand-ins — stub contexts, stub workers, message recorders — live directly in `test-utils/`, named
  for the stand-in (`create-stub-worker-context`, `create-test-connection`), and are never called
  factories.
- `setupTest` wires runtime — servers, handlers, clients, recorders — and returns no domain data and
  no data-builders. It builds the environment; the scenario — every row, every override — is written
  in the test body.
- `toStrictEqual` when the test determines every field of the expected value — the full shape is the
  contract, and writing it out is the point. `toMatchObject`, or asymmetric matchers inside
  `toStrictEqual`, when the value carries fields the test doesn't determine: faker defaults,
  timestamps, engine-computed state. Choosing partial because the full literal is long is a defect —
  length is the contract. Never `toEqual`.

  ```ts
  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: expect.toBeObject(),
    rewardSlots: expect.toBeArray(),
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
  ```

- Snapshots are inline only: `toMatchInlineSnapshot` pins deterministic machine output no human
  derives by reading the code (AGENTS.md "Golden values in tests"). File-based snapshots
  (`toMatchSnapshot`, `.snap`) and component snapshots never appear; a large-object expectation is
  `toStrictEqual` with explicit values.
- Production derivation output is a golden value and is pinned; a mock implementation's derived
  values assert properties instead — output shape, same-input determinism, distinct inputs give
  distinct outputs — because a mock's exact digests are not contract.
- A deterministic pipeline's suite opens with a frozen-golden test: one hand-written literal input
  (never a factory — regenerating with `bun test -u` must never move the input), the full output
  pinned with `toMatchInlineSnapshot`. Its companion is a one-line same-input determinism test,
  `expect(collectNodeEdges(chunk)).toStrictEqual(collectNodeEdges(chunk))` — the snapshot pins the
  value, the pair pins that equal inputs give equal outputs.
- A thrown error is asserted at the strictness its contract demands: bare
  `expect(() => …).toThrow()` when only throwing matters, `toThrowWithMessage(Error, /…/)` when the
  message is contract, and a typed service rejection narrows on `code` — never on message strings.
- A test body contains no branching: narrowing a maybe-value is a one-line `invariant(...)`
  (`tiny-invariant`) — never `?.`/`??` fallbacks inside `expect` arguments, which turn a missing
  value into a passing comparison — and a conditional path in a test means two tests. An `if` inside
  an MSW handler implementation scripting a call sequence ("first call fails, second succeeds") is
  handler scripting, not test branching.
- Time control follows the code's own shape, most explicit form first. Code that steps with time
  takes a duration or timestamp argument (`simulation.run(10_000)`, `advanceToDuration(20_000)`);
  code with an internal loop takes an injected controlled clock stepped explicitly (xstate's
  `SimulatedClock` driven by `clock.increment(ms)`, or a `createFastClock()` passed as the runtime's
  `now` option). A unit with no injection point that reads the global clock or schedules real timers
  is driven with `setSystemTime` and fake timers, restored when the test finishes — the fallback for
  code whose time the test cannot otherwise reach, not a substitute for an injection point the code
  already offers. A wall-clock-dependent row is built with a relative fixture
  (`expiresAt: new Date(Date.now() - 1000)`) and asserted with range matchers (`toBeAfter`,
  `toBeBefore`, `toBeWithin`).
- Waiting on an async condition is `waitFor`, never a `setTimeout` — RTL's `waitFor` in React
  packages (it wraps retries in `act`), `@vers/test-utils` elsewhere.
- A test that passes alone but fails in the full run has a cleanup gap: binary-search the file list
  for the leaking test, find the leaked state — a cache, a singleton, an unreset store — and add its
  reset to the preload's `afterEach`. Reordering tests or picking unique keys to dodge the collision
  hides the gap.
- Global mock reset lives in the preload's `afterEach` (`mock.restore()`), never per-test.
- State a preload reset owns — Zustand stores (`registerZustandReset`, `@vers/client-test-utils`),
  MSW handlers (`registerMSWLifecycle`), the `@msw/data` store, registered mock holders, storage
  fakes — needs no per-test restore; adding one is noise. A package that adopts a persistent storage
  fake (fake-indexeddb, localStorage) sweeps it in the preload's `afterEach`; tests never rely on
  unique keys for isolation.
- A test that mutates global or environment state the preload doesn't own restores it in an
  `onTestFinished(...)` callback registered inside the test — never `try`/`finally`, never a
  lifecycle hook — so teardown runs whether the test passes or throws. A setup helper may register
  it for its callers.
- `mock.module` never appears in a test file and never targets a module for convenience. A module is
  stubbed only when the test runtime cannot host what it provides (`SharedWorker`, WebGL, RSC
  ambient context), via a preload `register-*-mock` module behind a reactive stub store, with a
  single exported writer (a `set-*` setter, or a `with-*` scope where the runtime demands a
  callback) as the only mutation path. A module mocked because of what it imports is a module-graph
  defect — fix the entrypoint.
- jest-extended matchers come from the `@zgeoff/bun-test-extended` preload; a package-local
  `augment-bun-test.ts` side-effect import brings their types into `tsc`.
- Test titles describe observable behaviour and never cite internal identifiers
  (`it flags the run as invalid`, not `it sets isValid to false`). A title is built verb + outcome +
  condition (`it rejects an activity owned by another caller with NOT_FOUND`), so a CI failure reads
  as a broken behaviour, not a broken implementation detail.
- Bound test-result names: `ctx` for a `setupTest(…)` result, `hook` for `renderHook(…)`, `rendered`
  for RTL `render(…)`, `signedIn` for a `createSignedInUser(…)` result — member-access off them,
  never pick properties into loose consts.
- An entity-construction ladder whose intermediates the test acts on stays inline — idle-core's
  `createMockSimulationContext()` → `createAvatar(data, ctx)` → `createActivity(data, ctx)` →
  `createCombatExecutor(activity, avatar, ctx)` is four lines in every suite by design; extracting a
  composite would hide the handles the test drives.
- Reach for jest-extended matchers instead of hand-rolling assertions. Frequently useful:
  - arrays: `toIncludeAllMembers`, `toIncludeSameMembers`, `toPartiallyContain`,
    `toIncludeAllPartialMembers`, `toSatisfyAll`
  - objects: `toContainEntry`, `toContainEntries`, `toContainAllKeys`, `toBeFrozen`
  - strings: `toStartWith`, `toEndWith`, `toInclude`, `toEqualCaseInsensitive`,
    `toEqualIgnoringWhitespace`
  - values: `toBeNil`, `toBeOneOf`, `toSatisfy`, `toBeWithin`, `toBeEmpty`
  - dates: `toBeAfter`, `toBeBefore`, `toBeBetween`, `toBeValidDate`
  - mocks: `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenCalledBefore`,
    `toHaveBeenCalledAfter`
  - errors/async: `toThrowWithMessage`, `toResolve`, `toReject` (both return a promise — always
    `await`)
- Matchers also work asymmetrically inside `toStrictEqual`/`toMatchObject`
  (`status: expect.toBeOneOf([…])`).
- Known gaps: `expect.pass`/`expect.fail` are unimplemented upstream and excluded from our types.
  It's `toEqualCaseInsensitive` — not `…Insensitively` as some docs claim; unknown matcher names
  fail typecheck here.

## MSW-mocked packages

- MSW mocks the external HTTP/service boundary — never internal abstractions. One shared `server`
  (`setupServer()`) per package in `mocks/node.ts`, its lifecycle wired by
  `registerMSWLifecycle(server)` (`@vers/test-utils/bun`) in the preload with
  `onUnhandledRequest: 'error'`. For oRPC procedures, per-test handlers are built with
  `buildMockService` / `mockService` (`@vers/client-test-utils/orpc`).
- A per-test `server.use(...)` handler models a deviation — an error code, a transport failure, a
  scripted call sequence — or captures inputs for assertion. Everything the stateful handlers can
  model comes from shaping the store, not an override: a missing row is already a not-found from the
  default handler. Happy-path behaviour comes from the service's stateful mock handlers over the
  `@msw/data` store (`build<Service>MockHandlers`, `@vers/mock-services`), driven by seeding its
  collections; a handler that re-implements service logic inline is a defect.
- Inputs are captured with an inline `mock()` the per-test handler feeds, asserted through the mock
  matchers. A side-effect endpoint with no `@msw/data` backing that several tests inspect — an email
  send, a webhook — instead exports a stateful store from its handler module (`sentEmails`), swept
  by the preload; the store, the URL constant, and the resolver are separate exports so a per-test
  deviation can wrap or replace them.

  ```ts
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getActivityRewards.handler((opts) => {
      track(opts.input);

      return { items: [], verifiedHead: 2 };
    }),
  );

  expect(track).toHaveBeenCalledExactlyOnceWith({ activityID: activity.id });
  ```

- Stateful backends use `@msw/data`: an in-memory store built from a zod schema
  (`new Collection({ schema })`, `.create()`/`.createMany()`, `.findFirst()`/`.findMany()`,
  `.defineRelations()`) read and written directly from the oRPC mock handlers — never `@msw/data`'s
  `factory()` model dictionary. Every row-schema field carries a `.default()` — faker-driven where
  the value is arbitrary — except a discriminator whose value gives a row its meaning; the preload
  seeds faker once so runs are reproducible, and a `.create()` call never restates a default.
- React: React Testing Library on happy-dom (registered in the preload). Prefer the project `render`
  util over bare RTL and the utils it returns over the imported `screen`; a test that needs its own
  provider tree may use bare RTL `render`, still asserting through the returned utils. Load server
  data through the MSW handlers and `@msw/data` store — never by stubbing hooks. Drive client state
  through a package's exported setters (`setSelectedNode`), never raw `setState` pokes; `waitFor`
  the fetch before asserting.
- Interactions go through `userEvent.setup()`, created once per test and driving the full chain
  (`user.type`, `user.click`). `fireEvent` is reserved for events `userEvent` cannot produce — a raw
  `input` on an OTP field, an outside-dismiss pointer sequence on `document.body`, a react-three
  `renderer.fireEvent` — never a shortcut past a real interaction.
- Query by what the user perceives: `getByRole` (with `name`) first, then
  `getByLabelText`/`getByText`; `getByTestId` last. `getBy*` asserts presence, `queryBy*` absence,
  `findBy*` async appearance — after a render that suspends or fetches, the first query is an
  `await findBy*` so the settled tree is what sync queries then read; a synchronous render starts
  with `getBy*` directly. `findBy*` replaces `waitFor(() => getBy*)` — the combination double-polls;
  `waitFor` is for conditions that aren't DOM queries (store state, mock call counts).

  ```tsx
  const user = userEvent.setup();
  const rendered = renderWithRouter(<LoginForm action={rejectWithResponse} />);

  const email = await rendered.findByLabelText('Email');

  await user.type(email, 'player@vers.test');
  await user.type(rendered.getByLabelText('Password'), 'password123');
  await user.click(rendered.getByRole('button', { name: 'Login' }));
  ```

- Proving an element never appears is a bounded rejection —
  `await expect(rendered.findByTestId('spinner')).toReject()` with a short per-call `timeout` and a
  comment justifying the window — never a fixed sleep.
- A three-scene component (`components-three/`) renders through `ReactThreeTestRenderer` and fires
  events with `renderer.fireEvent(mesh, 'pointerEnter', …)`, asserting on store state; a DOM
  component (`components-ui/`) goes through RTL and `userEvent`.
- Router-aware components mount through `renderWithRouter`, which returns the `router` beside the
  render utils. Assert a transition on `router.state.location.pathname` — memory history makes every
  `navigate` a real transition — and declare each destination through the `routes` option so it
  lands on an explicit marker route instead of the catch-all re-rendering the component under test.
  Never capture the router through a probe component or a module-level variable, and never stub
  `navigate` to a no-op.

## RSC and server functions

- Server functions are thin ambient shells: they read request context (`getRequestHeaders`, cookies)
  and load data, then delegate to a pure component or handler taking that data as explicit
  props/args. A unit that needs ambient server context in a test has its ambient read in the wrong
  place — move the read up to the shell.
- A function that returns React elements is a component: write it as one and test it by rendering.
  Pure server components render under RTL + happy-dom like any component — render per state, assert
  visible behaviour.
- Server-fn bodies are named exported handlers that `createServerFn` wraps, so tests call the body
  directly.
- An uncompiled `createServerFn` dispatch relays only a `Response` or a thrown redirect/error to its
  caller; a plain result object resolves as `undefined`. Component tests cover the branches that
  round-trip that way — plain-object branches are asserted at the handler layer.
- The Flight pipeline (`renderServerComponent`, composite components) and ambient reads cannot run
  under bun test (one module graph, no `react-server` export condition); their coverage is the
  real-runtime smoke suite.
- Ambient request context (`@tanstack/react-start/server`) is stubbed only through the shared
  `withRequestContext` util, installed once in the preload behind a mutable holder — never Start's
  RSC/render APIs. Every stubbed ambient path is also crossed by the smoke suite. A test wraps the
  render and its assertions in the callback; the call is awaited for its `{ cookies, value }`
  outcome, or deliberately left un-awaited so a rejection can be asserted on it.

  ```tsx
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<AccountScreen />);

    await expect(rendered.findByText(signedIn.username)).resolves.toBeInTheDocument();
  });
  ```

- A thrown router redirect is asserted directly —
  `expect(promise).rejects.toMatchObject({ options: { href: '/login' } })` — and the no-redirect
  branch asserts the resolved value. Never a `.catch(isRedirect)` ternary, never a sentinel return,
  never an `instanceof` throw-guard where `invariant` narrows.

## Forms (Conform)

- A form island drives a Conform form through the shared `useFormSubmit` hook (`lib/forms/`): pass
  the form's server function and it dispatches the `FormData`, returning `lastResult` for `useForm`,
  an in-flight flag, and the submit handler. The handler runs `parseWithZod(formData)` and returns
  `submission.reply()`; the honeypot check stays a server-side helper. Validation imports from
  `@conform-to/zod/v4`.
- The hook also takes an optional seed `lastResult`, which an island forwards from props beside the
  action. Cover a form's result→UI mapping by rendering with a hand-built
  `submission.reply()`-shaped `lastResult` and asserting the errors — a form-level message under the
  empty-string key, a field message under the field name. This reaches every branch with no submit
  and no server. Inject an action to drive pending state and the `Response` fallback.

## Real-database packages

`service-avatar` is the reference example.

- **Production service factory.** A service exposes one `create<Service>Service({ db? })` in `src/`,
  owning its `createService` config; the production entrypoint and every test call that same
  factory. `db` is injected only in tests, for transaction isolation — never clone the
  `createService` config into tests.
- **Single-statement atomicity is the default.** A conditional `UPDATE`/`DELETE ... RETURNING`,
  `INSERT ... ON CONFLICT`, or a data-modifying CTE claims a single-row invariant and survives a
  serverless process kill with no orphaned transaction state. Reach for an interactive
  `db.transaction()` only for a genuine multi-row invariant that doesn't reduce to one statement —
  and give that handler's suite `schema` isolation, since the default transaction-isolation handle
  cannot nest.
- **Isolation strategy.** Acquire the database through `@vers/service-test-utils/bun`:
  `createTestDB()` returns an `await using` handle over one of three isolation levels. `transaction`
  (rollback on dispose) is the default. `schema` (a real, committed clone of `public` in its own
  schema on a shared database) is the opt-out for code that commits mid-op or continues after a
  caught constraint violation, cases where a rolled-back transaction can't nest and an aborted
  statement poisons the rest of a shared test transaction. `database` (a real, committed clone
  database) is reserved for database-scoped state (advisory locks, LISTEN/NOTIFY), DDL and migration
  exercises, and structures `LIKE` can't reproduce (partitioned parents). Inject the handle's `db`
  into the code under test — code that opens its own connection bypasses the isolation. A suite that
  opts out of `transaction` carries a comment naming the code path that forces it ("createChain
  opens its own interactive transaction, which the default handle can't nest").
- **Test setup.** A local `setupTest()` per suite — typed config in, named props out, no `if` —
  builds the db and boots the service. It may seed what the service needs to boot (a sim version, a
  content document); scenario data — anything a test asserts on — stays in the test body. Never
  centralise it: a shared `setupTest` accretes conditionals as services multiply. Multiple
  `await using` handles tear down last-in-first-out, so a resource declared after the db closes
  before the db drops.

  ```ts
  async function setupTest() {
    const db = await createTestDB();
    const service = await createAvatarService({ db: db.db });

    return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
  }
  ```

- **Test data — factories + composites.** Every domain entity/DTO gets a faker-defaulted
  `create-mock-*.ts` factory in `test-utils/factories/` (a plain object, never persisted, never
  requiring a parent), each with its own test. Persisted or wired data goes through a
  composite/entity-util (`create-*.ts`, no `-mock-`) that sources its defaults from the factory.
- **Composites build/register/return DATA, never runtime utils** (no clients, apps, servers).
  Default to the shared factories/composites even on first use; a test with more refined needs may
  still build actors bespoke. `createViewer`/`createAnonymousViewer`
  (`@vers/service-test-utils/bun`) are the shared s2s-actor composites; build the client in-test via
  `buildRPCTestClient(app, { token })`.
- **A composite maps to a domain concept the system already names.** Two engineers reading only the
  name agree on what it wires (`createViewer`, `createSignedInUser`); a name that needs the file
  opened (`createUserWithAvatarAndTwoActivities`) is a convenience grouping — the test composes
  primitives instead. A variant is its own file and export (`createAnonymousViewer` beside
  `createViewer`), never a flag or an `if` inside one composite. No batch overloads: several rows
  are several calls, mapped through `Promise.all` when order doesn't matter.
- A row composite's doc comment names the scenario the service's own procedures can't reach —
  seeding another user's rows, backdating `createdAt`, writing a known TOTP secret. That
  justification is the test for whether a direct database write is legitimate; a composite that
  can't state one is a procedure call that should go through the service. Its test pair asserts the
  wiring with `toMatchObject` (the persisted row carries DB-computed fields) and that overrides
  apply.
- Read-back verification is `.selectFrom(…).selectAll().where(…).executeTakeFirstOrThrow()` when the
  row must exist — narrowing to `.select('col')` when one column is the subject — and absence is
  `executeTakeFirst()` with `toBeUndefined()`. A utility that interpolates an identifier into SQL
  carries a dedicated rejection test for its guard.
- **Every service carries the same scaffolding suites.** `create-<service>-service.test.ts` holds
  the injection pair — an injected db is wired into the router (drive one write, assert the row
  landed in the handle), and the service boots from `env.DATABASE_URL` when none is injected, each
  boot disposed. `build-router.test.ts` holds the conformance loop: every case from
  `collectConformanceCases` driven through `await expect(case.run(ctx.app)).toResolve()` — the
  sanctioned loop over assertions.
- **Failure paths are contract.** Assert on the rejection directly —
  `expect(promise).rejects.toMatchObject({ code })` — never try/catch, and test each declared error.
  Bun's matcher types declare `.rejects`/`.resolves` chains synchronous, so they are not `await`ed;
  `toResolve()`/`toReject()` are the two matchers typed as promises and are `await`ed. When a later
  query in the same test must observe the rejected call's transaction settled, drain it first:
  `await request.catch(() => {});` then the un-awaited `expect(request).rejects.toMatchObject(…)`.
- **Authorisation is tested in pairs.** Every ownership or access rule lands with its positive and
  its negative test — "the owner reads it" and "another caller is rejected" are two tests, and the
  cross-actor case is named explicitly. Each actor is minted with `createViewer` and holds its own
  client. A write or targeted read rejects; a read path that hides instead of rejecting asserts
  `toBeNull()`. The anonymous pair (`createAnonymousViewer`) applies to procedures that resolve the
  acting user; a pure service-to-service procedure carries none.

  ```ts
  test('it rejects an activity owned by another caller with NOT_FOUND', async () => {
    await using ctx = await setupTest();

    const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
    const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

    const ownerClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: owner.token });

    const started = await ownerClient.startActivity({ avatarID: avatar.id, scopeID: '0_0' });
    const other = await createViewer({ audience: 'service-activity', db: ctx.db });

    const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: other.token });

    expect(otherClient.getActivityRewards({ activityID: started.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  ```

- **Timestamps never encode insertion order.** Under `transaction` isolation `now()` is pinned to
  the transaction's start, so every DB-defaulted timestamp column in a test carries the same value —
  and JS-side factory defaults collide at millisecond resolution anyway. A test asserting an order,
  or a winner, among rows whose sort keys tie passes explicit distinct timestamps. A production
  query ordered by a timestamp carries a total-order tiebreaker
  (`.orderBy('deployedAt', 'desc').orderBy('id', 'desc')`) when callers need a stable result, and
  the tie gets its own test:

  ```ts
  test('it breaks a deployedAt tie toward the later insert', async () => {
    await using ctx = await setupTest();

    const at = new Date('2026-01-01T00:00:00Z');

    await createReleaseRow(ctx.db, { app: 'vers-app-web', deployedAt: at });

    const later = await createReleaseRow(ctx.db, { app: 'vers-app-web', deployedAt: at });

    expect(findLatestRelease(ctx.db, 'vers-app-web')).resolves.toStrictEqual(later);
  });
  ```

- **Infrastructure failures run on real transports.** A database-unreachable branch runs the real
  driver against an address nothing listens on — never a stubbed query method — with the handle
  destroyed in `onTestFinished`. A downstream-service failure is a per-test MSW handler that throws.

  ```ts
  const unreachableDB = createDB({ databaseURL: 'postgresql://bad:bad@127.0.0.1:1/nope' });

  onTestFinished(async () => {
    await unreachableDB.destroy();
  });

  const drained = await drainReplayQueue({ db: unreachableDB });

  expect(drained).toBe(0);
  ```

  ```ts
  server.use(
    mockKeysService.deriveScopeSecret.handler(() => {
      throw new Error('keys backend unreachable');
    }),
  );

  expect(client.startActivity(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  ```

- **Naming.** Prefix titles `#procedureName` only when one file holds several procedures' tests;
  plain `it …` when a file covers one unit.
- **Env.** Permanent env is a direct `process.env` assignment in the preload; per-test overrides go
  through `updateEnv`, restored by `removeEnvOverrides` in the preload's `registerBunTestCleanup()`.
- **Auth.** s2s tests use the real verification path: an asymmetric keypair from
  `getTestServiceKeyPair()`, tokens minted with `createServiceToken`.

## Observability

- A counter's suite is two tests: record it two or three times with distinct attributes and read the
  points back through `createInMemoryMetrics()` (`@vers/test-utils/bun`) — never a hand-rolled
  `MeterProvider` — then the fixed-title `it stays inert without a registered meter provider`
  asserting the record call doesn't throw.
- Spans are captured with an in-memory harness: `InMemorySpanExporter` behind a
  `NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })`, registered in the
  test and torn down in `onTestFinished` as `trace.disable()` **then** `await provider.shutdown()` —
  that order, or the global registration leaks process-wide.
- Error reporting is asserted against the real Sentry SDK: a well-formed fake DSN,
  `disableDefaultIntegrations: true`, and a `beforeSend` that records the event and returns `null`
  so nothing egresses; `waitFor` the recorder before asserting.
- A log line is asserted through an injected write-capture stream —
  `createLogger({ level, stream: { write: (line) => lines.push(line) } })`, `JSON.parse` the line,
  `toMatchObject` — always paired with a below-level test asserting `toBeEmpty()`. Never a spy on
  the logger.
- An OTLP exporter's success path runs against a loopback receiver: `Bun.serve({ port: 0 })`
  capturing requests, the endpoint injected with `updateEnv`, the server stopped in
  `onTestFinished`; assert path, headers, and a non-empty body.

## Contracts and scripts

- A contract module's suite is a triad: each procedure's `errorMap` keys via
  `toContainAllKeys`/`toContainKey`, an explicit `status` assertion per bespoke code, and a closing
  OpenAPI-generation test through `new OpenAPIGenerator({ schemaConverters: […] })`.
- A schema rejection asserts the issue path with one matcher shape —
  `expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['field'] }))` —
  never positional `issues[0]` (couples the test to issue ordering) and never `code` in place of
  path.
- An accept test reads `result.data` — `expect(Schema.parse(payload)).toStrictEqual(payload)` where
  the schema passes values through, explicit expected values where it transforms. A bare
  `success: true` passes for a schema that strips, coerces, or defaults wrongly.
- A rejection payload restates the full valid literal with one field changed — the deliberate
  consequence of banning module-level fixtures, not duplication to clean up.
- A collection scanner's suite carries an explicit negative-scope test naming what it never touches
  (`it never touches other machines' databases`) — for sweep logic that drops resources, the test
  that matters most.
