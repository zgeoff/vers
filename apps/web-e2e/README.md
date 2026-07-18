<div align="center">
  <h1>@vers/web-e2e</h1>

  <p>Playwright end-to-end test suite for the web app.</p>
</div>

## Environment

<!-- env:begin -->

| Variable                   | Description                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | —                                                                                                                     |
| `SERVICE_AUTH_PRIVATE_KEY` | any valid Ed25519 key — the mock backend never verifies signatures. generate with: openssl genpkey -algorithm ed25519 |
| `SESSION_SECRET`           | 32+ characters — session sealing rejects shorter                                                                      |

<!-- env:end -->
