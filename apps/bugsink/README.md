# app-bugsink

Self-hosted [Bugsink](https://www.bugsink.com) error tracker, deployed on Fly as `vers-bugsink`.
Browser and server exceptions ingest here over the Sentry protocol: each vers app has its own
Bugsink project, and that project's DSN is the only wiring an app carries.

This directory holds Fly config only — no workspace package, nothing to build. The app runs the
pinned stock `bugsink/bugsink` image; a merge to `main` touching this directory redeploys it, so
upgrading Bugsink is a tag bump in `fly.toml`. A manual roll is
`fly deploy --config apps/bugsink/fly.toml`.

## Storage

Event data lives in a dedicated database in the shared Neon project (`DATABASE_URL` secret) — no app
runs its own database, the machine keeps no volume, and Bugsink's SQLite-on-Docker-volume warning
never applies.

## Secrets

| Secret             | Value                                              |
| ------------------ | -------------------------------------------------- |
| `SECRET_KEY`       | `openssl rand -base64 50`                          |
| `DATABASE_URL`     | the Neon `bugsink` database, pooled connection URL |
| `CREATE_SUPERUSER` | `email:password` — first boot only, unset after    |

## API tokens

Tokens are minted in the Bugsink UI or with `bugsink-manage create_auth_token` over
`fly ssh console`. Two exist: the MCP server's token, stored as `mcp-token` on the `bugsink` item in
the `vers` 1Password vault (read by `.mcp.json` at connect time), and CI's source-map upload token,
stored as the `SENTRY_AUTH_TOKEN` GitHub secret beside the `VITE_SENTRY_DSN` GitHub variable.
