# Service providers

vers hands each cross-cutting concern to a dedicated service, and this catalog names the service
behind each concern and the interface that fronts it. Each concern rides a vendor-neutral interface:
OpenTelemetry for telemetry, OpenFeature for flags, the Sentry ingest protocol for errors. The
backend behind that interface is a swap, not a migration. Single-purpose providers beat a bundled
platform: the app owns the pipe, the provider owns one job.

## Platform

- **Fly.io** — compute. Every service and the web app runs as its own scale-to-zero deployment; the
  private mesh, rollout, and secrets live in [deployment](./deployment.md).
- **Neon** — Postgres. One scale-to-zero database holds both the relational identity data and the
  event store ([database](./database.md)).
- **Cloudflare** — DNS, plus the R2 bucket backing the Pulumi state.

## Communication

- **Resend** — transactional email, sent from the React Email templates in `@vers/email`.

## Observability

- **Bugsink** — error tracking, self-hosted on Fly (`apps/bugsink`). Browser and server exceptions
  ingest over the Sentry protocol ([error handling](./error-handling.md)).
- **Axiom** — traces, logs, and metrics. Every service and the web server exports to it over
  OpenTelemetry ([observability](./observability.md)).

## Analytics

- **Umami** — web analytics, self-hosted on Fly (`apps/umami`). Traffic, acquisition, and funnel
  metrics for the web app.
- **Tinybird** — product analytics. Behavioural events land in managed ClickHouse and are served as
  SQL query endpoints.

The split between web and product analytics lives in [analytics](./analytics.md).

## Feature flags

- **OpenFeature** — the evaluation interface the app codes against; an in-house provider serves the
  values ([feature flags](./feature-flags.md)).
