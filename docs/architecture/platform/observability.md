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

`createService` boots the Elysia OTel plugin before the Sentry SDK, and the order matters. The
OpenTelemetry API keeps only the first global tracer, context manager, and propagator registration
per process. Sentry's own OpenTelemetry bootstrap registers unconditionally, so going second its
registration silently no-ops and the plugin's W3C propagation and OTLP export stay in effect.
Reversed, Sentry's `sentry-trace`-only propagator would shadow `traceparent`, and no service span
would reach the OTLP exporter. app-web's `server.ts` awaits its own trace and metrics boot before
starting Sentry for the same reason.

Each exporter configures itself from the standard `OTEL_EXPORTER_OTLP_*` environment variables. The
per-signal headers carry the ingest token and dataset routing. Metrics route by the
`X-Axiom-Metrics-Dataset` header. The `X-Axiom-Dataset` header covers only traces and logs.

`Service.stopTelemetry` flushes pending exports and releases the metric reader's periodic timer. The
timer otherwise keeps the event loop alive. An entrypoint that traps SIGTERM for a graceful drain
calls `stopTelemetry` before closing its database pool, since a final gauge collection may still
query.

## Traces

One span opens per unit of work and stays active across every await inside it, so a query, an RPC
call, or a manual span nests under the work that caused it. Where the work originates decides which
site opens the span.

- **Inbound request, a service** — every service's Elysia app carries the `@elysiajs/opentelemetry`
  plugin, which opens one SERVER span per request from the inbound `traceparent` and keeps it active
  across every await. A Kysely query, an RPC client call, or a manual span reads it through
  `context.active()`.
- **Inbound request, app-web** — app-web carries no such plugin. `withRequestTrace`
  (`apps/web/src/server/with-request-trace.ts`) opens the same SERVER span itself, skipping a served
  static asset or the `/health` probe.
- **Database query** — every `Kysely` client (`createDB`, `@vers/db`) emits a retroactively timed
  CLIENT span per compiled query from its `log` callback, named `db.<operation>` from the query's
  root node kind and carrying the compiled SQL, never its parameters.
- **Database connect** — a `db.connect` CLIENT span wraps each connection acquired from the driver's
  pool, covering the phase neither the query span nor a session timeout observes.
- **Service-to-service call** — every `RPCLink` carries `buildTracingInterceptor`
  (`@vers/service-utils/orpc`) in its `clientInterceptors`, minting a CLIENT span per call named by
  the procedure path.
- **No inbound request** — a worker iteration, a boot drain, a scheduled sweep, or a queued job
  opens its own root span through `withRootSpan` (`@vers/service-utils`).

Trace context crosses process boundaries through the OpenTelemetry API's global propagator, never
`@vers/trace` directly:

- At a boundary span site — the server plugins and outbound clients — an outbound call carries
  `traceparent` from the active span, continuing the caller's trace across every hop.
- A root span opened through `withRootSpan` starts a fresh trace, because a worker iteration or
  queued job has no caller's trace to continue.
- app-web's RPC proxy re-injects `traceparent` from its own active context rather than forwarding
  the browser's raw header, so the service span parents to app-web's server span instead of becoming
  its sibling.
- `@vers/trace`'s `parseTraceparent`/`buildTraceparent` are the wire-format utilities and the
  fallback path. A process with no tracer provider registered, or a request outside any span (a
  served asset, `/health`), derives its trace id by parsing the inbound header directly and minting
  a fresh one when none arrives — the same trace-continuation guarantee an active span normally
  provides.

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
- A request past its slow-request threshold logs at `warn` instead, with `slow: true` and
  `thresholdMs` added onto the completion line, unless its status is already a server error. The
  threshold defaults to 2s (`slowRequestMs`, a `createService` config option) and is overridable per
  pathname through `slowRequestOverridesMs`.
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

Alerting is Axiom threshold monitors over these datasets, notifying the `vers alarms` notifier.
Every Axiom resource is managed as code in the `infra/` Pulumi program (`axiom.ts`). A console edit
to any resource is drift, reconciled by the next `pulumi up`. The sensitive outputs Pulumi records
in stack state are encrypted by the stack passphrase.

## Instrument registry

| Instrument                                      | Type            | Unit             | Attributes          | Meaning                                                                                                                                         |
| ----------------------------------------------- | --------------- | ---------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `vers.replay.verification_lag`                  | histogram       | `s`              | —                   | seconds between an append landing and a drain cycle confirming it                                                                               |
| `vers.replay.wake`                              | counter         | `{wake}`         | —                   | wake requests received                                                                                                                          |
| `vers.replay.drain_duration`                    | histogram       | `s`              | —                   | wall-clock duration of one drain cycle                                                                                                          |
| `vers.replay.backlog_claimed`                   | histogram       | `{chain}`        | —                   | chains claimed and adjudicated in one drain cycle                                                                                               |
| `vers.verification.rejections`                  | counter         | `{rejection}`    | `reason`            | adjudications that rejected or parked an activity, by reason                                                                                    |
| `vers.replay.iteration_failures`                | counter         | `{iteration}`    | `outcome`           | worker iterations that failed to replay a claimed chain, by outcome                                                                             |
| `vers.replay.settled_xp`                        | up-down counter | `{xp}`           | `source`            | XP that verified segments settled to avatars, by how the amount was derived                                                                     |
| `vers.replay.clamped_settlements`               | counter         | `{settlement}`   | —                   | settlements whose debit was clamped to a minimum of zero, paying less than recorded                                                             |
| `vers.keys.derive_rejections`                   | counter         | `{rejection}`    | `reason`            | derivation calls that refused to derive a roll key or scope secret, by reason                                                                   |
| `vers.activity.terminal_transitions`            | counter         | `{activity}`     | `status`            | activities that claimed a terminal transition, by status                                                                                        |
| `vers.activity.writer_takeovers`                | counter         | `{takeover}`     | —                   | successful writer-session claims on active activities                                                                                           |
| `vers.activity.replay_poke_failed`              | counter         | `{poke}`         | —                   | replay wake pokes that never delivered after exhausting retries                                                                                 |
| `vers.activity.avatar_not_active_rejections`    | counter         | `{rejection}`    | —                   | active-avatar-gated calls the shared `requireActiveAvatar` helper rejected because the acting avatar is not active (startActivity, revealNodes) |
| `vers.activity.node_unreachable_rejections`     | counter         | `{rejection}`    | —                   | startActivity calls rejected because the scope node is outside the avatar's selectable set                                                      |
| `vers.activity.content_incompatible_rejections` | counter         | `{rejection}`    | `path`              | startActivity calls rejected because the resolved engine's max content version falls behind the requested content                               |
| `vers.activity.advance_continuations`           | counter         | `{continuation}` | `outcome`           | advanceActivity continuations processed, by mint outcome                                                                                        |
| `vers.activity.advance_bailouts`                | counter         | `{bailout}`      | `reason`            | advanceActivity requests that bailed before their continuations' end, by reason                                                                 |
| `vers.activity.reveal_cells`                    | histogram       | `{cell}`         | —                   | revealed cells returned per getRevealedNodes query                                                                                              |
| `vers.activity.reveal_sources`                  | histogram       | `{grant}`        | —                   | first-clear grant rows scanned per getRevealedNodes query                                                                                       |
| `vers.activity.reveal_mints`                    | counter         | `{node}`         | —                   | activity-chain rows minted or re-affirmed per revealNodes call                                                                                  |
| `vers.email.delivery_failures`                  | counter         | `{email}`        | —                   | emails that failed to deliver                                                                                                                   |
| `vers.session.failed_attempts`                  | counter         | `{attempt}`      | —                   | failed step-up verification attempts                                                                                                            |
| `vers.analytics.delivery_failures`              | counter         | `{event}`        | `reason`            | product events that never landed in the Tinybird data source, by reason                                                                         |
| `vers.web.service_call_retries`                 | counter         | `{retry}`        | `service`           | retry attempts against an outbound service call that failed its previous attempt                                                                |
| `vers.web.service_call_failures`                | counter         | `{call}`         | `service`, `reason` | outbound service calls that never delivered, by service and reason                                                                              |

`service-activity` pokes `service-replay`'s `POST /wake` each time an append advances an activity
past its verified cursor. The handler drains the queue — claiming and adjudicating chains until none
remain claimable — before responding, so every instrument in `service-replay` emits only while a
drain is actually running and stays silent on an idle, scaled-to-zero machine.
`vers.replay.verification_lag` records once per newly verified append, from the append's own
timestamp to the moment the drain confirms it.

`vers.verification.rejections` splits by `reason`:

- `integrity-mismatch` — confirmed divergence or seed validation.
- `version-park` — unknown or retention-expired sim version, a version-registry problem needing
  fleet action.
- `elapsed-time` — replay duration cap tripped, a per-stream anomaly.
- `provider-unavailable` — a cross-version dispatch's provider timed out, refused the connection, or
  answered with an undefined error; repeated occurrences distinguish a dead provider deploy from
  normal cold-boot latency.
- `unbacked-snapshot` — the activity's build snapshot borrowed xp from a run that has since been
  rejected, so the level and life it plays at were never proven; a rise tracks how far one rejection
  propagates through an avatar's later runs.
- `descriptor-mismatch` — a sealed node's stamped content fields failed to reproduce against a
  freshly read scope secret, on the segment's first verification pass.

Each recording's log line carries the raw numbers behind it (heads, checkpoint counts, sim version).

`vers.replay.settled_xp` splits by `source`: `progress` is a segment settling the per-checkpoint
deltas it verified, `terminal` a segment settling a run's final total net of what earlier segments
settled. The measure is signed, since a failed run's terminal settles its death penalty as a
negative, and an up-down counter is the instrument that keeps negative recordings — a histogram
discards them. A `terminal` sum that drifts from the runs completing, or a `progress` sum going
negative, is a contribution-rule defect.

`vers.replay.clamped_settlements` stays at zero while the penalty and the settled total are computed
against the same base: the engine clamps a failure penalty to the progress made into the current
level, so a debit cannot exceed an avatar's settled XP. A non-zero count means they have diverged,
and the shortfall is silent everywhere else.

The remaining split instruments enumerate their attribute values:

- `vers.replay.iteration_failures` by `outcome`: `quarantined` is an activity that exhausted its
  replay attempts; `errored` is every other failed iteration.
- `vers.keys.derive_rejections` by `reason`: `unknown-key-version` is an avatar roll-key version
  absent from the population's custodied roots; `unknown-scope-secret-version` is the same for a
  scope secret.
- `vers.activity.terminal_transitions` by `status`: `stopped` is a completed or failed last
  checkpoint; `capped` is a batch rejected whole for exceeding the avatar's accrued offline budget.
- `vers.activity.advance_continuations` by `outcome`: `minted` is a continuation whose mint landed a
  fresh row; `converged` is one that resolved onto a row a prior, partially committed request
  already minted at the same client id.
- `vers.activity.advance_bailouts` by `reason`, one per `advanceActivity` rejection code
  (`conflict`, `checkpoint_invalid`, `activity_capped`, `session_evicted`, `chain_quarantined`,
  `terminal`). A bailout always leaves the confirmed head advanced past the committed prefix, so a
  rising count tracks how often an offline catch-up's outer resync must re-plan, not lost progress.
- `vers.activity.content_incompatible_rejections` by `path`: `requested` is a client-sent
  sim-version hash; `fallback` is the registry-current version resolved for a start that carries no
  hash.
- `vers.activity.reveal_cells` and `vers.activity.reveal_sources` record once per `getRevealedNodes`
  call — the returned cell count and the scanned first-clear grant count. Both track the reveal
  projection's fan-out as an avatar's completed-node history grows.
- `vers.activity.reveal_mints` records once per `revealNodes` call — the number of distinct nodes it
  minted or re-affirmed a chain row for. A repeat reveal of an already-minted node still counts,
  since the call re-affirms that row's `genesisSeed` rather than skipping it.
- `vers.analytics.delivery_failures` by `reason`: `rejected` is a non-2xx response from the Tinybird
  Events API; `quarantined` is a row the API accepted but failed schema validation; `unreachable` is
  a network failure or the upstream deadline tripping.

`vers.web.service_call_retries` and `vers.web.service_call_failures` cover app-web's bounded
outbound service calls: `service_call_retries` records each retry attempt against a call that failed
its previous attempt, and `service_call_failures` records a call whose final attempt still failed,
split by `reason` — `timeout` when that final attempt hit its own per-attempt bound, `transport`
when it failed some other way before the bound fired. A `timeout` burst against one `service` tracks
a Fly machine's autosuspend resume window; a sustained `transport` run against the same service
points at a genuinely unreachable machine.

The `vers replay poke failed` threshold monitor watches `vers.activity.replay_poke_failed` and
notifies `vers alarms`. It alerts on the threshold alone, never on no data — the counter emits only
when a wake delivery exhausts its retries, so a quiet dataset is the healthy default, not a down
exporter. It is the explicit signal that the replay queue may go undrained despite an activity
appending unverified work.

The `vers slow requests` threshold monitor watches `vers-traces` for any non-probe server span past
a fixed 30s duration threshold and notifies `vers alarms`, evaluated on its own schedule rather than
at span close. Health-probe routes are excluded because their latency tracks scale-to-zero machine
wake rather than request handling. It is the fleet-wide alarm for a hung or pathologically slow
request, independent of the per-request slow-request warn log a service's own `slowRequestMs`
threshold decides.

## Alarms channel

Axiom monitors, the CI pipeline, and Bugsink post to one Discord channel. The CI `alert` job posts a
structured embed — a `[CI] critical — …` title, the failing run's link, and a red severity colour
(`#e5484d`, decimal `15026253`) — in `.github/workflows/main.yml`. Axiom and Bugsink post their
tools' stock formats: Axiom's custom-webhook notifier, the one templated body it offers, is not
enabled on the plan, and Bugsink's Discord messaging service exposes no templating.
