# Observability testing

Metrics, spans, error reports, and log lines are outputs with callers: dashboards, alerts, and the
person reading an incident. Tests read them back through in-memory or loopback receivers, and they
run the real SDK, never a spy on it.

## Metrics

The OpenTelemetry API hands out a no-op meter while no meter provider is registered, and a meter
created at module load keeps that no-op meter for the whole run. Instrumented code therefore calls
`metrics.getMeter(…)` when it records, not at module load.

A counter's suite has two tests:

1. `it records <metric> per <attribute>`: register a meter provider with an in-memory reader through
   the repo's metrics test util, record the counter two or three times with distinct attributes,
   then read the points back and assert each point's attributes and value. The util calls
   `metrics.disable()` and shuts the provider down in `onTestFinished`.
2. `it stays inert without a registered meter provider`: call the record function with no provider
   registered and assert that it does not throw.

## Spans

A tracer that code gets at module load binds to the first tracer provider it sees, and a provider
registered by a later test never reaches it. So the preload registers one tracer provider for the
whole run, with an `InMemorySpanExporter` behind a `SimpleSpanProcessor`, and clears the exporter
after each test. A test reads the spans its code finished from that exporter.

```ts
// register-tracing.ts, listed in the bunfig.toml preload
new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(spanExporter)] }).register();

afterEach(() => {
  spanExporter.reset();
});
```

```ts
test('it records a span for each note it saves', async () => {
  await using ctx = await setupTest();

  await saveNote(ctx.db, { title: 'groceries' });

  expect(spanExporter.getFinishedSpans().map((span) => span.name)).toStrictEqual(['notes.save']);
});
```

A test never registers its own tracer provider. `register()` also installs the global context
manager and propagator, so a test that registers one leaves them behind for every later test.

## Error reports

Assert error reporting against the real Sentry SDK. Initialise it with a well-formed fake DSN,
`defaultIntegrations: false`, and a `beforeSend` that records the event and returns `null`, so no
event leaves the process. `waitFor` the recorder before asserting, because the SDK sends
asynchronously.

## Log lines

Give the logger an injected destination stream, `{ write: (line) => lines.push(line) }`. Parse each
captured line with `JSON.parse` and assert it with `toMatchObject`. Pair each such test with one
that logs below the configured level and asserts `toBeEmpty()` on the captured lines. Never spy on
the logger.

## Exporters

Test an exporter's success path against a loopback receiver: `Bun.serve({ port: 0 })` records each
request, the test points the exporter's endpoint at it through the env util, and `onTestFinished`
stops the server. Assert the request path, the headers, and a non-empty body.
