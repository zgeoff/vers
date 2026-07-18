<div align="center">
  <h1>@vers/service-activity</h1>

  <p>Activity domain service: owns the game's event store — activity streams of simulation
  checkpoint batches, and the current-activity and latest-progress reads the client resumes
  from.</p>
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
