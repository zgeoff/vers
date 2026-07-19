---
name: testing
description:
  vers testing conventions — the three regimes by package kind, the no-mock / no-branching /
  co-location rules, `bun test` process-wide lifecycle, isolation levels, factories and composites,
  jest-extended matchers, and the MSW / RSC / Forms / real-database specifics. Load when designing,
  writing, or reviewing tests.
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

## Everywhere

- Never use `describe` — write flat `test(…)` blocks with behavioural titles that start with "it"
  (`test('it pads before a return statement', …)`).
- Test files are co-located with the module they test (`parse-source.ts` beside
  `parse-source.test.ts`) — no `test/`, `tests/` or `__tests__` directories. Declaration emit
  excludes `*.test.ts`, so they never ship.
- A test whose unit consumes a domain object or DTO takes it from the package's faker-defaulted
  `create-mock-*` factory in `test-utils/factories/` (each factory has its own test), overriding
  only the fields the unit reads.
- A unit that parses or validates raw input — a zod schema, a decoder — is tested with inline
  literal payloads, valid and invalid, never factory output: a factory built to satisfy a schema
  cannot falsify it. A rejection test asserts the reported issue path, never bare `success: false` —
  a payload invalid for any reason passes the bare boolean.
- An input that is neither a domain object nor a DTO — a plain argument, an options bag, a config —
  is written inline at the call site, even when tests repeat the literal; repeated data reads, an
  opaque baseline doesn't. Test files declare no baseline-builder helpers and no module-level
  fixtures shared between tests.
- A factory is called in the test that uses its value, never through a helper that pre-configures
  overrides — a second layer of defaults is a shadow factory the test site can't see.
- `test-utils/factories/` holds only faker-defaulted plain-data `create-mock-*` factories. Runtime
  stand-ins — stub contexts, stub workers, message recorders — live directly in `test-utils/`, named
  for the stand-in (`create-stub-worker-context`, `create-test-connection`), and are never called
  factories.
- `setupTest` wires runtime — servers, handlers, clients, recorders — and returns no domain data and
  no data-builders.
- `toStrictEqual` when the test determines every field of the expected value — the full shape is the
  contract, and writing it out is the point. `toMatchObject`, or asymmetric matchers inside
  `toStrictEqual`, when the value carries fields the test doesn't determine: faker defaults,
  timestamps, engine-computed state. Choosing partial because the full literal is long is a defect —
  length is the contract. Never `toEqual`.
- A test body contains no branching: narrowing a maybe-value is a one-line `invariant(...)`
  (`tiny-invariant`), waiting on an async condition is `waitFor` (`@vers/test-utils`), and a
  conditional path in a test means two tests. An `if` inside an MSW handler implementation scripting
  a call sequence ("first call fails, second succeeds") is handler scripting, not test branching.
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
  (`it flags the run as invalid`, not `it sets isValid to false`).
- Bound test-result names: `ctx` for a `setupTest(…)` result, `hook` for `renderHook(…)`, `rendered`
  for RTL `render(…)` — member-access off them, never pick properties into loose consts.
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
- Matchers also work asymmetrically inside `toEqual`/`toMatchObject`
  (`status: expect.toBeOneOf([…])`).
- Known gaps: `expect.pass`/`expect.fail` are unimplemented upstream and excluded from our types.
  It's `toEqualCaseInsensitive` — not `…Insensitively` as some docs claim; unknown matcher names
  fail typecheck here.

## MSW-mocked packages

- MSW mocks the external HTTP/service boundary — never internal abstractions. One shared `server`
  (`setupServer()`) per package in a `mocks/` module, its lifecycle wired by
  `registerMSWLifecycle(server)` (`@vers/test-utils/bun`) in the preload with
  `onUnhandledRequest: 'error'`. For oRPC procedures, per-test handlers are built with
  `buildMockService` / `mockService` (`@vers/client-test-utils/orpc`).
- A per-test `server.use(...)` handler models a deviation — an error code, a transport failure, a
  scripted call sequence — or captures inputs for assertion. Happy-path behaviour comes from the
  service's stateful mock handlers over the `@msw/data` store (`build<Service>MockHandlers`,
  `@vers/mock-services`), driven by seeding its collections; a handler that re-implements service
  logic inline is a defect.
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
  RSC/render APIs. Every stubbed ambient path is also crossed by the smoke suite.

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
  into the code under test — code that opens its own connection bypasses the isolation.
- **Test setup.** A local `setupTest()` per suite — typed config in, named props out, no `if` —
  builds the db and boots the service, with no data. Never centralise it: a shared `setupTest`
  accretes conditionals as services multiply.
- **Test data — factories + composites.** Every domain entity/DTO gets a faker-defaulted
  `create-mock-*.ts` factory in `test-utils/factories/` (a plain object, never persisted, never
  requiring a parent), each with its own test. Persisted or wired data goes through a
  composite/entity-util (`create-*.ts`, no `-mock-`) that sources its defaults from the factory.
- **Composites build/register/return DATA, never runtime utils** (no clients, apps, servers).
  Default to the shared factories/composites even on first use; a test with more refined needs may
  still build actors bespoke. `createViewer`/`createAnonymousViewer`
  (`@vers/service-test-utils/bun`) are the shared s2s-actor composites; build the client in-test via
  `buildRPCTestClient(app, { token })`.
- **Failure paths are contract.** Assert on the rejection directly —
  `expect(promise).rejects.toMatchObject({ code })` — never try/catch, and test each declared error.
  Bun's matcher types declare `.rejects`/`.resolves` chains synchronous, so they are not `await`ed;
  `toResolve()`/`toReject()` are the two matchers typed as promises and are `await`ed.
- **Naming.** Prefix titles `#procedureName` only when one file holds several procedures' tests;
  plain `it …` when a file covers one unit.
- **Env.** Permanent env is a direct `process.env` assignment in the preload; per-test overrides go
  through `updateEnv`, restored by `removeEnvOverrides` in the preload's `registerBunTestCleanup()`.
- **Auth.** s2s tests use the real verification path: an asymmetric keypair from
  `getTestServiceKeyPair()`, tokens minted with `createServiceToken`.
