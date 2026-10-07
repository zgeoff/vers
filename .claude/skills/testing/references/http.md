# HTTP mocking

A package that calls a remote service over HTTP or RPC tests against MSW handlers. The handlers
answer from an in-memory store that holds the remote service's state, so a test shapes that state
and lets the real client code run: its requests, serialisation, retries, and error handling.
Per-test handlers exist only for what the store cannot express. The [testing skill](../SKILL.md)
rules on setup, data, and assertions apply throughout.

## The server and its lifecycle

- Each package has one MSW server, `setupServer(...handlers)`, exported from `mocks/node.ts`. The
  preload starts it, resets its handlers after each test, and closes it at the end of the run.
- The server starts with `onUnhandledRequest: 'error'`. A request that no handler matches fails the
  test and names its URL.
- A suite that sends real requests to a server it started on the loopback interface passes a
  callback: loopback hosts go through, and every other unmatched request still errors. The preload
  carries a comment that names the loopback traffic.

```ts
server.listen({
  // the sync suites call test servers on ephemeral loopback ports
  onUnhandledRequest: (request, print) => {
    const { hostname } = new URL(request.url);

    if (['127.0.0.1', '[::1]', 'localhost'].includes(hostname)) {
      return;
    }

    print.error();
  },
});
```

## Stateful handlers

The default handlers implement the remote service's behaviour over an `@msw/data` store: they read
and write collections, validate input, and return the real response shape. A test seeds the
collections and calls the client.

- The default handlers return the not-found response for a missing record and the refusal for a
  permission failure. Shape the store to reach those outcomes; never add a per-test handler for
  them.
- Each collection takes its shape from a zod schema (`new Collection({ schema })`). Every field in
  the schema has a `.default()`, using faker where the value is arbitrary. The one exception is a
  discriminator whose value gives a record its meaning. A `.create()` call never restates a default.
- `@msw/data`'s `factory()` model dictionary never appears.
- A handler takes its response type from the production contract, so a change to the real API breaks
  the mock at typecheck.

## Per-test handlers

`server.use(...)` in a test adds a handler for one of two reasons:

- **A deviation** that the store cannot express: an error status, a transport failure, a malformed
  payload, or a scripted sequence such as a failure followed by a success. An `if` inside such a
  handler scripts the remote side, and it is not branching in the test.
- **Capturing input.** The handler feeds an inline `mock()`, and the test asserts it with the mock
  matchers.

```ts
const received = mock<(input: unknown) => void>();

server.use(
  http.post(`${NOTES_API_URL}/notes/:noteID/share`, async ({ request }) => {
    received(await request.json());

    return HttpResponse.json({ shared: true });
  }),
);

await shareNote(client, { noteID: 'note_1', email: 'sam@example.test' });

expect(received).toHaveBeenCalledExactlyOnceWith({ email: 'sam@example.test' });
```

A per-test handler never re-implements the service's happy path: that path belongs to the default
handlers.

A side-effect endpoint with no collection behind it, such as an email send, that several tests
inspect exports a store from its handler module, such as `sentEmails`, and the preload clears it.
The store, the URL constant, and the resolver function are separate exports, so a test can wrap or
replace each one. A handler module never contains a `mock()` call: other consumers of the module,
such as a dev server, have no test runner, and a reset between tests would strip the mock's
behaviour from every consumer.

## A mock API shared across packages

When several packages in one repo call the same service, its collections, builders, and handlers
live in one shared workspace package. That package has no test-runner dependency, so a dev server or
a story can load it as well. Each consuming package builds its MSW server out of the shared handler
list and runs the lifecycle in its own preload.

- The store's `reset()` clears dependent collections before the collections they reference. A
  comment above the calls says the order is deliberate.
- MSW matches handlers in registration order. Register a literal route, such as `/notes/archived`,
  before a parameterised sibling, such as `/notes/:noteID`, which would otherwise match it. A
  comment above the handler array says the order is deliberate.

## RPC contracts

A contract module's suite has three parts:

1. Each procedure's error map holds the codes it declares, asserted with `toContainAllKeys`.
2. Each custom error code has an explicit assertion of its HTTP status.
3. A closing test generates the OpenAPI document from the contract, which proves the contract and
   its schema converters produce one.

## Queues and other stateful services

A queue, a pub/sub topic, or a job service without a faithful emulator sits behind a thin wrapper
that the code receives by injection. The test version of that wrapper holds queryable state: the
test enqueues through the real code, then inspects, drains, or advances what the wrapper holds. A
stub that only records a call shows that the call happened, not what was enqueued or what the
receiver does with it. Mock the client below the orchestration, so the code that decides what to
enqueue and when runs for real. The preload clears the wrapper's state.

## Auth tokens

- A test that covers token verification signs its tokens with a test key pair, and the real verifier
  checks the signature and the claims.
- A mock that needs only the caller's identity, such as a mock backend that scopes records to a
  user, may read the token's claims without verifying the signature.
- The code under test never skips verification. A flag that turns verification off for tests is a
  production code path that only tests use.
