# Observability

The fleet emits three OpenTelemetry signals, traces, logs, and metrics, and Axiom consumes them, one
dataset per signal. Error reporting is a separate path through the Sentry SDK to Bugsink
([error handling](../services/error-handling.md)). Every Axiom resource is managed as code in the
`infra/` Pulumi program ([infra drift](./deployment.md#infra-drift)).

## Export path

The service runtime wires every signal through `createService` when the OTLP endpoint variable is
set, one transport per signal: traces through the Elysia OpenTelemetry plugin, logs through a
pino-to-OTLP stream, and metrics through a process-global meter provider behind a periodic exporter.
The web app carries no Elysia plugin and boots its own exporters for all three signals. A process
with the endpoint unset emits nothing, and every instrument stays the OpenTelemetry API's no-op.

The runtime boots OpenTelemetry before the Sentry SDK, and the order matters. The OpenTelemetry API
keeps only the first global tracer, context manager, and propagator registration per process, and
Sentry's own bootstrap registers unconditionally. Going second, Sentry's registration no-ops and W3C
propagation and OTLP export stay in effect; reversed, Sentry's propagator would shadow `traceparent`
and no service span would reach the exporter.

Each exporter configures itself from the standard `OTEL_EXPORTER_OTLP_*` variables, whose per-signal
headers carry the ingest token and dataset routing. Stopping telemetry flushes pending exports and
shuts the metric reader down. An entrypoint that shuts down gracefully on SIGTERM stops telemetry
before it closes its database pool, since a final gauge collection may still query.

## Traces

One span opens per unit of work and stays active across every await inside it, so a query, an RPC
call, or a manual span nests under the work that caused it. Where the work originates decides which
site opens the span:

- An inbound request to a service: the Elysia plugin opens one SERVER span from the inbound
  `traceparent`.
- An inbound request to the web app: its request middleware opens the same SERVER span itself,
  skipping a served static asset and the health probe.
- A database query: every Kysely client emits a CLIENT span per compiled query, carrying the
  compiled SQL and never its parameters, and a CLIENT span per connection acquired from the pool.
- A service-to-service call from a server: a server-side RPC link carries a tracing interceptor that
  opens a CLIENT span per call. A browser link stamps the header and opens no span.
- No inbound request: a worker iteration, a boot drain, a scheduled sweep, or a queued job opens its
  own root span, which starts a fresh trace.

The web app extracts an inbound `traceparent` through the OpenTelemetry API's global propagator, and
an outbound call writes `traceparent` from the active trace context. The web app's RPC proxy
re-injects `traceparent` from its own context rather than forwarding the browser's raw header, so
the service span parents to the web app's server span. A request outside any span derives its trace
id by parsing the inbound header directly and mints a fresh one when none arrives.

Wherever a span is active, it is the source of truth for the request's identity: a request's
exported span trace id, its `x-trace-id` response header, and every log line's trace id field agree.
One exception: a response built with immutable headers, such as a redirect, ships unstamped and
correlates through its log lines only. A span carries semantic-convention attributes for its kind
and never a raw per-entity id or secret material, the same cardinality and leakage discipline metric
attributes follow.

## Log lines

Every pino logger stamps the active request's trace id onto each entry, and HTTP responses report
the same id in `x-trace-id`, so one trace id names a request's log lines across the web app and the
services it called. The line-level conventions:

- Data rides in structured fields, never interpolated into the message. The message is a stable
  label for the event, and the fields are what Axiom queries filter and aggregate on.
- Severity follows outcome: a 5xx response or a thrown handler logs at `error`, a 4xx at `warn`,
  everything else at `info`.
- A failure always emits a line at the site that decides the outcome, carrying the reason in a
  field.
- Each request logs one completion line with its method, path, status, and duration. The query
  string never reaches a log line, because query params carry emailed tokens, auth codes, and
  GET-mapped procedure inputs. A service leaves its health probe unlogged; the web app logs its
  probe like any request and logs a served static asset at `debug`.
- A service logs a request past its slow-request threshold at `warn`, with a per-path override,
  unless its status is already a server error. A service or the web app writes an overdue line for a
  request still open past the overdue threshold, the one record a request that never finishes
  leaves.
- Presentation is the transport's job: dev consoles pretty-print, and call sites never embed
  decoration in the message.

## Metrics

Instrumentation is part of a feature: work that adds a pipeline, queue, worker, or failure path
lands with the metrics that make it observable. The conventions:

- Instruments are defined in the owning package through the global metrics API (`metrics.getMeter`).
  Domain code never constructs, receives, or stops a meter provider; the service runtime owns that
  lifecycle.
- Names are dot-namespaced `vers.<domain>.<measure>`, units use UCUM annotations, and attributes are
  snake_case with closed value sets, never unbounded values like per-entity ids.
- A rare, meaningful event is a counter recorded at the site that decides it, a `record-*.ts`
  module, and the recording's log line carries the raw numbers behind it.
- Database-resident state observes through observable gauges: one batch callback per package, one
  snapshot query per collection, failures caught and logged so a bad query never takes down the
  process it observes.
- An instrument's `description` and `unit` in its definition are its registry. A grep for the
  instrument constructors (`createCounter`, `createHistogram`, `createUpDownCounter`,
  `createObservableGauge`) finds every instrument with its meaning attached.

The replay service's instruments emit only while a drain runs, so an idle, scaled-to-zero machine
reads quiet.

## Alarms

Each Axiom threshold monitor alerts on its threshold alone, never on no data, because a failure
counter that emits only on failure reads quiet when healthy. The monitors:

- 5xx responses: a server span that completed with a 5xx status. The central error interceptor has
  already reported the failure to Bugsink with its trace id, so the alarm is the prompt to open that
  event.
- Slow requests: a server span that completed but took longer than a player would wait, probes
  excluded because probe latency tracks machine wake.
- Overdue requests: the overdue log line, which covers a request that never finishes and so never
  exports a span.
- Replay poke failed: the activity service's wake poke to the replay service exhausted its retries,
  so the queue may go undrained while unverified work sits in it.
- Activity refusals: starts and appends the activity service refused, grouped by reason, each reason
  alerting on its own. The threshold sits above one transient stale-head conflict and below a device
  stuck retrying a refused chain.

Axiom monitors, the CI pipeline, and Bugsink all post to one Discord channel. CI posts a structured
embed; Axiom and Bugsink post their tools' stock formats.
