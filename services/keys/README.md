<div align="center">
  <h1>@vers/service-keys</h1>

  <p>Keys domain service: owns avatar roll-key custody and derivation.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                      | Presence       | Description                                                                                                                                 |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOG_LEVEL`                   | default `info` | —                                                                                                                                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional       | —                                                                                                                                           |
| `PORT`                        | default `3000` | —                                                                                                                                           |
| `ROLL_KEY_ROOTS`              | required       | JSON payload of per-population roll-key roots: each population carries its current key version and every root version still derived against |
| `SENTRY_DSN`                  | optional       | —                                                                                                                                           |
| `SERVICE_AUTH_PUBLIC_KEY`     | required       | Ed25519 SPKI public key inbound s2s tokens are verified against                                                                             |

<!-- env:end -->
