<div align="center">
  <h1>@vers/service-verification</h1>

  <p>Verification domain service: owns the OTP and TOTP verification flows.</p>
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
