# Observability

The fleet emits three OpenTelemetry signals — traces, logs, and metrics — and consumes them from
Axiom. Error reporting is a separate path (Sentry SDK → Bugsink), covered by
[error-handling](../services/error-handling.md). Provisioning and secrets live in
[deployment](./deployment.md).

## Export path

All three signals export over OTLP (protobuf) to Axiom, one dataset per signal: `vers-traces` and
`vers-logs` (Events type), `vers-metrics` (Metrics type).

The service scaffold (`createService`, `@vers/service-runtime`) wires every signal when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set, one transport per signal:

- traces through `@elysiajs/opentelemetry`
- logs through a pino → OTLP stream
- metrics through a process-global meter provider behind a periodic exporter (`startMetricsExport`,
  `@vers/service-utils/otel`)

app-web carries no Elysia plugin — its `server.ts` boots the same trace and metrics export itself
through `startTraceExport`/`startMetricsExport`. A process with the endpoint unset emits nothing,
and every instrument stays the OpenTelemetry API's no-op.

`createService` boots the Elysia OTel plugin before the Sentry SDK: the OpenTelemetry API keeps only
the first global tracer, context manager, and propagator registration per process, and Sentry's own
OpenTelemetry bootstrap registers unconditionally — going second, its registration silently no-ops
and the plugin's W3C propagation and OTLP export stay in effect. Reversed, Sentry's
`sentry-trace`-only propagator would shadow `traceparent` and no service span would ever reach the
OTLP exporter. app-web's `server.ts` awaits its own trace/metrics boot before starting Sentry for
the same reason.

Each exporter configures itself from the standard `OTEL_EXPORTER_OTLP_*` environment variables. The
per-signal headers carry the ingest token and dataset routing. Metrics route by the
`X-Axiom-Metrics-Dataset` header. The `X-Axiom-Dataset` header covers only traces and logs.

`Service.stopTelemetry` flushes pending exports and releases the metric reader's periodic timer. The
timer otherwise keeps the event loop alive. An entrypoint that traps SIGTERM for a graceful drain
calls `stopTelemetry` before closing its database pool, since a final gauge collection may still
query.

## Traces

Every service's Elysia app carries the `@elysiajs/opentelemetry` plugin, which opens one SERVER span
per request from the inbound `traceparent` and keeps it active across every await inside the handler
— a Kysely query, an RPC client call, a manual span all read it through `context.active()`. app-web
carries no such plugin; `withRequestTrace` (`apps/web/src/server/with-request-trace.ts`) opens the
same SERVER span itself, skipping a served static asset or the `/health` probe. Every `Kysely`
client (`createDB`, `@vers/db`) emits a retroactively timed CLIENT span per compiled query from its
`log` callback, named `db.<operation>` from the compiled query's root node kind and carrying the
compiled SQL (never its parameters). Every service-to-service `RPCLink` carries
`buildTracingInterceptor` (`@vers/service-utils/orpc`) in its `clientInterceptors`, minting a CLIENT
span per call named by the procedure path. A worker iteration, a boot drain, a scheduled sweep, or a
queued job — anything with no inbound request to continue — opens its own root span through
`withRootSpan` (`@vers/service-utils`).

Boundary span sites — the server plugins and outbound clients — inject or extract `traceparent`
through the OpenTelemetry API's global propagator, never `@vers/trace` directly: outbound calls
carry `traceparent` from the active span, continuing the caller's trace across every hop. A root
span opened through `withRootSpan` starts a fresh trace with no inbound context — a worker iteration
or queued job has no caller's trace to continue. app-web's RPC proxy re-injects `traceparent` from
its own active context rather than forwarding the browser's raw header, so the service span parents
to app-web's server span instead of becoming its sibling. `@vers/trace`'s
`parseTraceparent`/`buildTraceparent` stay the wire-format utilities and the fallback path: a
process with no tracer provider registered, or a request outside any span (a served asset,
`/health`), derives its trace id by parsing the inbound header directly and minting a fresh one when
none arrives — the same trace-continuation guarantee a request normally gets from its active span.

Wherever a span is active, it is the source of truth for the request's identity:
`findSpanTraceContext` (`@vers/service-utils`) reads the active span's own trace and span ids, and
every reader of the ambient `TraceContext` — the pino mixin that stamps log lines, the `x-trace-id`
response header, an outbound `traceparent` — derives from it. A request's exported span trace id,
its `x-trace-id` response header, and every log line's `traceID` field always agree.

A span carries semantic-convention attributes for its kind: `http.method`/`http.route`/
`http.status_code` on a SERVER span, `db.system`/`db.statement` on a Kysely CLIENT span. A span
never carries a raw per-entity id or secret material as an attribute — the same cardinality and
leakage discipline metric attributes follow.

Once OTel is wired, every app in the fleet emits: one server span per request (app-web skips served
static assets and `/health`), with the DB, s2s, and external-HTTP calls a request makes recorded as
its children; one structured request-completion log line; unexpected errors reported to Sentry
through the central `onError`/error-boundary hook, never a bespoke `captureException` call; and the
registry-listed metrics for the failure paths it owns.

## Log lines

Every pino logger stamps the active request's trace id onto each entry through an AsyncLocalStorage
mixin. HTTP responses report the same id in `x-trace-id`, so one trace id names a request's log
lines across app-web and the services it called. A response built with immutable headers (a
`Response.redirect`) passes through unstamped and correlates through its request line instead. The
line-level conventions:

- Data rides in structured fields, never interpolated into the message:
  `logger.info({ method, path, status, durationMs }, 'request completed')`. The message is a stable
  label for the event; the fields are what Axiom queries filter and aggregate on.
- Severity follows outcome: a 5xx response or a thrown handler logs at `error`, a 4xx at `warn`,
  everything else at `info`.
- A failure always emits a line at the site that decides the outcome — an error folded into a result
  value, a rejected token, a failed job. The line carries the reason in a field (`err`, `failure`,
  the validation issues).
- Each request logs one line on completion with `method`, `path`, `status`, and `durationMs`. The
  query string never reaches a log line: query params carry emailed tokens, auth codes, and
  GET-mapped procedure inputs. The service scaffold emits the line for every `/rpc` request and
  leaves `/health` unlogged, so platform probes don't dominate volume. app-web's middleware emits it
  for every request, at `debug` for a served static asset (a pathname with a file extension).
- Presentation is the transport's job: dev consoles pretty-print through `pino-pretty`, and call
  sites never embed color codes or decoration in the message.

## Metrics

Instrumentation is part of a feature: work that adds a pipeline, queue, worker, or failure path
lands with the metrics that make it observable. The conventions:

- Instruments are defined in the owning package through the global metrics API
  (`metrics.getMeter('@vers/<package>')` from `@opentelemetry/api`).
- Domain code never constructs, receives, or stops a meter provider — the scaffold owns that
  lifecycle. Instruments resolved through the API bind to whatever provider the process registered
  at boot.
- Names are dot-namespaced `vers.<domain>.<measure>`.
- Attributes are snake_case with closed value sets, never unbounded values like per-entity IDs —
  those explode cardinality and cost.
- Units use UCUM annotations (`s`, `{activity}`, `{rejection}`).
- A rare, meaningful event is a counter, recorded at the site that decides the event (a
  `record-*.ts` module).
- Database-resident state is never counted in application code; it observes through observable
  gauges — one batch callback per package, one snapshot query per collection, failures caught and
  logged so a bad query never takes down the process it observes.
- Every instrument lands with its row in the instrument registry, in the same PR.

Alerting is Axiom threshold monitors over these datasets. Each monitor notifies the custom-webhook
notifier for its severity, which posts the canonical alarms embed (§ Alarms channel) to the Discord
channel. Every Axiom resource is managed as code in the `infra/` Pulumi program (`axiom.ts`); a
console edit to any resource is drift, reconciled by the next `pulumi up`, and the sensitive outputs
Pulumi records in stack state are encrypted by the stack passphrase.

## Instrument registry

| Instrument                           | Type    | Unit           | Attributes    | Meaning                                                                 |
| ------------------------------------ | ------- | -------------- | ------------- | ----------------------------------------------------------------------- |
| `vers.verification.lag`              | gauge   | `s`            | —             | age of the oldest unverified append across activity streams             |
| `vers.verification.head_delta.p95`   | gauge   | `{checkpoint}` | —             | p95 of appended-head minus verified-head over unverified streams        |
| `vers.verification.quarantined`      | gauge   | `{activity}`   | —             | activities quarantined after exhausting replay attempts                 |
| `vers.verification.parked`           | gauge   | `{activity}`   | `sim_version` | activities parked for operator resolution, by stamped sim version       |
| `vers.verification.rejections`       | counter | `{rejection}`  | `reason`      | adjudications that rejected or parked an activity, by reason            |
| `vers.replay.iteration_failures`     | counter | `{iteration}`  | `outcome`     | worker iterations that failed to replay a claimed chain, by outcome     |
| `vers.keys.derive_rejections`        | counter | `{rejection}`  | `reason`      | deriveAvatarKey calls that refused to derive a key, by reason           |
| `vers.activity.terminal_transitions` | counter | `{activity}`   | `status`      | activities that claimed a terminal transition, by status                |
| `vers.email.delivery_failures`       | counter | `{email}`      | —             | emails that failed to deliver                                           |
| `vers.session.failed_attempts`       | counter | `{attempt}`    | —             | failed step-up verification attempts                                    |
| `vers.analytics.delivery_failures`   | counter | `{event}`      | `reason`      | product events that never landed in the Tinybird data source, by reason |

The verification gauges observe from one snapshot query in `service-replay`
(`loadVerificationSnapshot`). A stream counts as unverified while appends sit past its verified
cursor and it hasn't been rejected. Parked and quarantined streams stay in, because an operator hold
is exactly the staleness the lag gauge exists to show. The optimistic client hides verifier failure
by design, so this gauge is the signal that verification has stalled.

`vers.verification.rejections` splits by `reason`:

- `integrity-mismatch` — confirmed divergence or seed validation.
- `version-park` — unknown or retention-expired sim version, a version-registry problem needing
  fleet action.
- `elapsed-time` — replay duration cap tripped, a per-stream anomaly.

Each recording's log line carries the raw numbers behind it (heads, checkpoint counts, sim version).

`vers.replay.iteration_failures` splits by `outcome`: `quarantined` covers an activity that
exhausted its replay attempts, `errored` covers every other failed iteration.
`vers.keys.derive_rejections` splits by `reason`, currently `unknown-key-version` alone.
`vers.activity.terminal_transitions` splits by `status`: `stopped` covers a completed or failed last
checkpoint, `capped` covers a batch rejected whole because it exceeded the avatar's accrued
simulated-time budget. `vers.analytics.delivery_failures` splits by `reason`: `rejected` covers a
non-2xx response from the Tinybird Events API, `quarantined` covers a row the API accepted but
failed schema validation on, `unreachable` covers a network failure or the upstream deadline
tripping.

The `vers verification lag` threshold monitor watches `vers.verification.lag` and notifies the
warning alarms notifier. It alerts on no data as well as on the threshold. The gauge exports from
`service-replay`'s always-warm machine ([deployment](./deployment.md)), so a silent dataset means
the exporter or the process around it is down, never a healthy quiet system.

## Alarms channel

Axiom monitors, the CI pipeline, and Bugsink post to one Discord channel. The first two share a
canonical embed so kind and severity read at a glance: a `[source] severity — what fired` title, a
description, one link to the investigation view, detail fields, and a severity colour.

| Severity | Meaning                            | Hex       | Discord decimal |
| -------- | ---------------------------------- | --------- | --------------- |
| critical | a failure needing action now       | `#e5484d` | `15026253`      |
| warning  | a degradation worth attention      | `#ffb224` | `16757284`      |
| recovery | a cleared alert returning to green | `#30a46c` | `3187820`       |

Axiom carries the embed through two custom-webhook notifiers, one per firing severity, whose
Go-templated body renders recovery colour and wording when a monitor clears (`infra/axiom.ts`). CI
builds the same embed at critical in the `alert` job (`.github/workflows/main.yml`). Bugsink posts
through its stock Discord messaging service, whose body is fixed by the app, so its new-issue,
regression, and unmute alerts keep their own shape (`apps/bugsink/README.md`).
