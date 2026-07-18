# Observability

How the fleet emits and consumes telemetry — traces, logs, and metrics. Error reporting is a
separate path (Sentry SDK → Bugsink) covered by `docs/architecture/error-handling.md`; provisioning
and secrets live in `docs/architecture/deployment.md`.

## Export path

All three OpenTelemetry signals export over OTLP (protobuf) to Axiom, one dataset per signal:
`vers-traces` and `vers-logs` (Events type), `vers-metrics` (Metrics type). The service scaffold
(`createService`, `@vers/service-runtime`) wires every signal when `OTEL_EXPORTER_OTLP_ENDPOINT` is
set — traces through `@elysiajs/opentelemetry`, logs through a pino → OTLP stream, metrics through a
process-global meter provider behind a periodic exporter (`startMetricsExport`,
`@vers/service-utils/otel`). A process with the endpoint unset emits nothing, and every instrument
stays the OpenTelemetry API's no-op.

Each exporter configures itself from the standard `OTEL_EXPORTER_OTLP_*` environment variables; the
per-signal headers carry the ingest token and dataset routing. Metrics route by the
`X-Axiom-Metrics-Dataset` header — the `X-Axiom-Dataset` header covers only traces and logs.

`Service.stopTelemetry` flushes pending exports and releases the metric reader's periodic timer,
which otherwise keeps the event loop alive. An entrypoint that traps SIGTERM for a graceful drain
calls it before closing its database pool, since a final gauge collection may still query.

## Log lines

Every pino logger stamps the active request's trace id onto each entry through an AsyncLocalStorage
mixin, and HTTP responses report the same id in `x-trace-id`, so one trace id names a request's log
lines across app-web and the services it called. A response built with immutable headers (a
`Response.redirect`) passes through unstamped and correlates through its request line instead. The
line-level conventions:

- Data rides in structured fields, never interpolated into the message:
  `logger.info({ method, path, status, durationMs }, 'request completed')`. The message is a stable
  label for the event; the fields are what Axiom queries filter and aggregate on.
- Severity follows outcome: a 5xx response or a thrown handler logs at `error`, a 4xx at `warn`,
  everything else at `info`.
- A failure always emits a line at the site that decides the outcome — an error folded into a result
  value, a rejected token, a failed job — carrying the reason in a field (`err`, `failure`, the
  validation issues).
- Each request logs one line on completion with `method`, `path`, `status`, and `durationMs`. The
  query string never reaches a log line — query params carry emailed tokens, auth codes, and
  GET-mapped procedure inputs. The service scaffold emits the line for every `/rpc` request and
  leaves `/health` unlogged so platform probes don't dominate volume; app-web's middleware emits it
  for every request, at `debug` for a served static asset (a pathname with a file extension).
- Presentation is the transport's job: dev consoles pretty-print through `pino-pretty`, and call
  sites never embed color codes or decoration in the message.

## Metrics

Instrumentation is part of a feature: work that adds a pipeline, queue, worker, or failure path
lands with the metrics that make it observable. The conventions:

- Instruments are defined in the owning package through the global metrics API
  (`metrics.getMeter('@vers/<package>')` from `@opentelemetry/api`). Domain code never constructs,
  receives, or stops a meter provider — the scaffold owns that lifecycle, and instruments resolved
  through the API bind to whatever provider the process registered at boot.
- Names are dot-namespaced `vers.<domain>.<measure>`. Attributes are snake_case with closed value
  sets — never unbounded values like per-entity IDs, which explode cardinality and cost.
- Units use UCUM annotations (`s`, `{activity}`, `{rejection}`).
- A rare, meaningful event is a counter, recorded at the site that decides the event (a
  `record-*.ts` module). State that lives in the database is not counted in application code — it
  observes through observable gauges: one batch callback per package, one snapshot query per
  collection, with failures caught and logged so a bad query never takes down the process it
  observes.
- Every instrument lands with its row in the registry below, in the same PR.

Alerting is Axiom threshold monitors over these datasets, notifying the `vers alarms` notifier.

## Instrument registry

| Instrument                         | Type    | Unit           | Attributes    | Meaning                                                           |
| ---------------------------------- | ------- | -------------- | ------------- | ----------------------------------------------------------------- |
| `vers.verification.lag`            | gauge   | `s`            | —             | age of the oldest unverified append across activity streams       |
| `vers.verification.head_delta.p95` | gauge   | `{checkpoint}` | —             | p95 of appended-head minus verified-head over unverified streams  |
| `vers.verification.quarantined`    | gauge   | `{activity}`   | —             | activities quarantined after exhausting replay attempts           |
| `vers.verification.parked`         | gauge   | `{activity}`   | `sim_version` | activities parked for operator resolution, by stamped sim version |
| `vers.verification.rejections`     | counter | `{rejection}`  | `reason`      | adjudications that rejected or parked an activity, by reason      |

The verification gauges observe from one snapshot query in `service-replay`
(`loadVerificationSnapshot`). A stream counts as unverified while appends sit past its verified
cursor and it hasn't been rejected — parked and quarantined streams stay in, because an operator
hold is exactly the staleness the lag gauge exists to show; the optimistic client hides verifier
failure by design, so this gauge is the signal that verification has stalled.

`vers.verification.rejections` splits by `reason`: `integrity-mismatch` (confirmed divergence or
seed validation), `version-park` (unknown or retention-expired sim version — version-registry
problems needing fleet action), `elapsed-time` (replay duration cap tripped — a per-stream anomaly).
Each recording's log line carries the raw numbers behind it (heads, checkpoint counts, sim version).

The `vers verification lag` threshold monitor watches `vers.verification.lag` and notifies
`vers alarms`, alerting on no data as well as on the threshold: the gauge exports from
`service-replay`'s always-warm machine (see [deployment](./deployment.md)), so a silent dataset
means the exporter or the process around it is down — never a healthy quiet system.
