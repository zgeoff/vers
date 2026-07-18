<div align="center">
  <h1>@vers/service-email</h1>

  <p>Transactional email delivery service: queues each send as a pg-boss job and delivers it through
  Resend, retrying on a backoff before dead-lettering.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                      | Presence       | Description                                                     |
| ----------------------------- | -------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                | required       | —                                                               |
| `EMAIL_FROM`                  | required       | —                                                               |
| `LOG_LEVEL`                   | default `info` | —                                                               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional       | —                                                               |
| `PORT`                        | default `3000` | —                                                               |
| `RESEND_API_KEY`              | required       | —                                                               |
| `SENTRY_DSN`                  | optional       | —                                                               |
| `SERVICE_AUTH_PUBLIC_KEY`     | required       | Ed25519 SPKI public key inbound s2s tokens are verified against |

<!-- env:end -->
