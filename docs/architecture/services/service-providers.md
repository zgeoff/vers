# Service providers

Each cross-cutting concern in vers runs on one dedicated provider, whether a hosted service, a
self-hosted app, or an in-house module, fronted by a vendor-neutral interface: OpenTelemetry for
telemetry, OpenFeature for flags, the Sentry ingest protocol for errors. Swapping the backend behind
an interface changes configuration, never call sites. Single-purpose providers beat a bundled
platform: the app owns the pipe, and the provider owns one job. The catalog below names the provider
behind each concern and the doc that owns its wiring.

## Platform

- **Fly.io** — compute. Every service and the web app runs as its own Fly deployment, and every
  domain service scales to zero; the private mesh, rollout, and secrets live in
  [deployment](../platform/deployment.md).
- **Neon** — Postgres. The shared Neon database scales to zero and holds every service's tables, the
  identity data and the activity checkpoint tables alike ([database](../platform/database.md)).
- **Cloudflare** — DNS, plus the R2 bucket backing the Pulumi state.

## Communication

- **Resend** — transactional email, sent from the React Email templates in `@vers/email`. The
  `qa.versidle.com` receiving domain holds the test addresses manual QA reads back through the
  Receiving API ([QA inbox](../platform/qa-inbox.md)).

## Observability

- **Bugsink** — error tracking, self-hosted on Fly (`apps/bugsink`). Browser and server exceptions
  ingest over the Sentry protocol ([error handling](./error-handling.md)).
- **Axiom** — traces, logs, and metrics. Every service and the web server exports to it over
  OpenTelemetry ([observability](../platform/observability.md)).

## Analytics

- **Umami** — web analytics, self-hosted on Fly (`apps/umami`). Traffic, acquisition, and funnel
  metrics for the web app.
- **Tinybird** — product analytics. Behavioural events land in managed ClickHouse and are served as
  SQL query endpoints.

[Analytics](../analytics.md) explains how web and product analytics divide.

## Feature flags

- **OpenFeature** — the evaluation interface the app codes against; an in-house provider serves the
  values ([feature flags](./feature-flags.md)).
