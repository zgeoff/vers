<div align="center">
  <h1>@vers/service-session</h1>

  <p>Session domain service: owns session rows and signs user tokens.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                      | Presence       | Description                                                     |
| ----------------------------- | -------------- | --------------------------------------------------------------- |
| `API_IDENTIFIER`              | required       | Issuer and audience stamped into signed user tokens             |
| `DATABASE_URL`                | required       | —                                                               |
| `JWT_SIGNING_PRIVKEY`         | required       | RS256 PKCS8 private key user tokens are signed with             |
| `LOG_LEVEL`                   | default `info` | —                                                               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional       | —                                                               |
| `PORT`                        | default `3000` | —                                                               |
| `SENTRY_DSN`                  | optional       | —                                                               |
| `SERVICE_AUTH_PUBLIC_KEY`     | required       | Ed25519 SPKI public key inbound s2s tokens are verified against |

<!-- env:end -->
