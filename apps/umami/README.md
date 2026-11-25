# app-umami

Self-hosted [Umami](https://umami.is) web analytics, deployed on Fly as `vers-umami`. The public
address serves the reporting dashboard. Tracker traffic arrives through `app-web`'s same-origin
analytics proxy at `/site.js` and `/site/api/send`, which forwards to the `UMAMI_URL` in `app-web`'s
`fly.toml` and stamps each visitor's address into `x-vers-client-ip`. Umami takes the address for
geolocation from the header set in `CLIENT_IP_HEADER`. `app-web` injects the tracker from its root
route when `VITE_UMAMI_WEBSITE_ID` is set at build time. For why the proxy exists and what belongs
in Umami versus the product-analytics stream, see [Analytics](../../docs/architecture/analytics.md).

This directory holds Fly config only. `fly.toml` deploys the pinned stock
`ghcr.io/umami-software/umami` image with no build. A merge to `main` touching this directory
redeploys it. To upgrade Umami, bump the tag on the `[build]` `image` line. To redeploy by hand, run
`fly deploy --config apps/umami/fly.toml`. `DISABLE_TELEMETRY` is set, so Umami sends no usage pings
of its own.

## Storage

Analytics data lives in a dedicated `umami` database in the shared Neon project (`DATABASE_URL`
secret). No app runs a Postgres server of its own, and the machine keeps no volume. Umami migrates
its schema itself on boot.

## Secrets

| Secret         | Value                                            |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | the Neon `umami` database, pooled connection URL |
| `APP_SECRET`   | `openssl rand -base64 32`                        |

## Admin

The admin credentials live on the `umami` item in the `vers` 1Password vault. The stock image boots
with `admin`/`umami`; change the password in the UI on first login. Manage websites and their
tracking IDs in the UI. The `vers` website's ID is the `VITE_UMAMI_WEBSITE_ID` GitHub Actions
variable baked into `app-web`'s client bundle.
