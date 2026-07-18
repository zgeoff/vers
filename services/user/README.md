<div align="center">
  <h1>@vers/service-user</h1>

  <p>User domain service: owns user accounts and their credentials.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                      | Presence       | Description                                                     |
| ----------------------------- | -------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                | required       | —                                                               |
| `LOG_LEVEL`                   | default `info` | —                                                               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional       | —                                                               |
| `PORT`                        | default `3000` | —                                                               |
| `SENTRY_DSN`                  | optional       | —                                                               |
| `SERVICE_AUTH_PUBLIC_KEY`     | required       | Ed25519 SPKI public key inbound s2s tokens are verified against |

<!-- env:end -->
