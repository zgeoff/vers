<div align="center">
  <h1>@vers/web</h1>

  <p>TanStack Start web app and the only public deployment: renders the game UI, terminates user
  sessions at the trust edge, and calls the domain services through typed oRPC clients.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                      | Presence       | Description                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `LOGGING`                     | default `info` | —                                                                               |
| `NODE_ENV`                    | required       | —                                                                               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional       | —                                                                               |
| `SENTRY_DSN`                  | optional       | —                                                                               |
| `SERVICE_AUTH_PRIVATE_KEY`    | required       | Ed25519 PKCS8 private key outbound s2s tokens are signed with                   |
| `TINYBIRD_INGEST_TOKEN`       | optional       | Append-scoped token for the product_events data source; unset disables delivery |
| `TINYBIRD_URL`                | optional       | Product-analytics Events API origin; unset disables delivery                    |
| `UMAMI_URL`                   | optional       | —                                                                               |
| `VITE_SENTRY_DSN`             | optional       | —                                                                               |

<!-- env:end -->
