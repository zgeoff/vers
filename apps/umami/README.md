# app-umami

Self-hosted [Umami](https://umami.is) web analytics, deployed on Fly as `vers-umami`. The public
address serves the reporting dashboard; tracker traffic arrives through `app-web`'s same-origin
analytics proxy (`/site.js` for the script, `/site/api/send` for beacons), which keeps it off
ad-blocker lists that match third-party analytics origins. `app-web` injects the tracker from its
root route when `VITE_UMAMI_WEBSITE_ID` is set at build time, and proxies to the `UMAMI_URL` in its
`fly.toml`. The proxy stamps each visitor's address into `x-vers-client-ip`, which
`CLIENT_IP_HEADER` tells Umami to trust for geolocation. Usage guidance — what belongs in Umami
versus the product-analytics stream — lives in `docs/architecture/analytics.md`.

This directory holds Fly config only — `fly.toml` deploys the pinned stock
`ghcr.io/umami-software/umami` image with no build. A merge to `main` touching this directory
redeploys it, and upgrading Umami is a tag bump on the `[build]` `image` line. A manual roll is
`fly deploy --config apps/umami/fly.toml`. `DISABLE_TELEMETRY` keeps Umami's own anonymous usage
pings off the wire.

## Storage

Analytics data lives in a dedicated `umami` database in the shared Neon project (`DATABASE_URL`
secret) — no app runs its own database and the machine keeps no volume. Umami migrates its schema
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
