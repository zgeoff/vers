# app-umami

Self-hosted [Umami](https://umami.is) web analytics, deployed on Fly as `vers-umami`. The public
address serves the reporting dashboard. Tracker traffic arrives through `app-web`'s same-origin
analytics proxy at `/site.js` and `/site/api/send`, which forwards to the `UMAMI_URL` in `app-web`'s
`fly.toml` and stamps each visitor's address into `x-vers-client-ip`. `CLIENT_IP_HEADER` tells Umami
to trust that header for geolocation. `app-web` injects the tracker from its root route when
`VITE_UMAMI_WEBSITE_ID` is set at build time. [Analytics](../../docs/architecture/analytics.md) owns
why the proxy exists and what belongs in Umami versus the product-analytics stream.

This directory holds Fly config only. `fly.toml` deploys the pinned stock
`ghcr.io/umami-software/umami` image with no build. A merge to `main` touching this directory
redeploys it, and upgrading Umami is a tag bump on the `[build]` `image` line. A manual roll is
`fly deploy --config apps/umami/fly.toml`. `DISABLE_TELEMETRY` is set, so Umami sends no usage pings
of its own.

## Storage

Analytics data lives in a dedicated `umami` database in the shared Neon project (`DATABASE_URL`
secret). No app runs its own database, and the machine keeps no volume. Umami migrates its schema
itself on boot.

## Secrets

| Secret         | Value                                            |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | the Neon `umami` database, pooled connection URL |
| `APP_SECRET`   | `openssl rand -base64 32`                        |

## Admin

The admin credentials live on the `umami` item in the `vers` 1Password vault. The stock image boots
with `admin`/`umami`; the password is changed in the UI on first login. Websites and their tracking
IDs are managed in the UI — the `vers` website's ID is the `VITE_UMAMI_WEBSITE_ID` GitHub Actions
variable baked into `app-web`'s client bundle.
