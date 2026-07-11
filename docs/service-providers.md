# Service providers

The external services vers depends on, one per concern. Each rides a vendor-neutral interface —
OpenTelemetry for telemetry, OpenFeature for flags, the Sentry ingest protocol for errors — so the
backend behind it is a swap, not a migration. A single-purpose provider is preferred over a bundled
platform: the app owns the pipe, the provider owns one job.

## Platform

- **Fly.io** — compute. Every service and the web app runs as its own scale-to-zero deployment on a
  private mesh.
- **Neon** — Postgres. One scale-to-zero database holding both relational identity data and the
  event store.
- **Cloudflare** — DNS, domain registrar, and R2 object storage backing the Pulumi state.

## Communication

- **Resend** — transactional email, sent from React Email templates in `@vers/email`.

## Observability

- **Bugsink** — error tracking, self-hosted on Fly (`apps/bugsink`). Browser and server exceptions
  ingest over the Sentry protocol.
- **Axiom** — traces, logs, and metrics. The OpenTelemetry export path from every service and the
  web server lands here.

## Analytics

- **Umami** — web analytics, self-hosted. Traffic and page metrics for the web app.
- **Tinybird** — product analytics. Behavioural events land in managed ClickHouse and are served as
  SQL query endpoints.

## Feature flags

- **OpenFeature** — the evaluation interface the app codes against. An in-house provider serves the
  values; the interface keeps the evaluation backend swappable.
