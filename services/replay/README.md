<div align="center">
  <h1>@vers/service-replay</h1>

  <p>Replay domain service: a queue-fed worker that replays simulation segments server-side to
  verify submitted checkpoints.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                      | Presence       | Description                                                                   |
| ----------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                | required       | —                                                                             |
| `KEYS_SERVICE_URL`            | required       | —                                                                             |
| `LOG_LEVEL`                   | default `info` | —                                                                             |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional       | —                                                                             |
| `PORT`                        | default `3000` | —                                                                             |
| `SENTRY_DSN`                  | optional       | —                                                                             |
| `SERVICE_AUTH_PRIVATE_KEY`    | required       | Ed25519 PKCS8 private key the worker signs outbound s2s tokens with           |
| `SERVICE_AUTH_PUBLIC_KEY`     | required       | Ed25519 SPKI public key inbound s2s tokens are verified against               |
| `SIM_ENGINE_HASH`             | required       | Engine hash baked at build; the provider answers replay only for this version |

<!-- env:end -->
