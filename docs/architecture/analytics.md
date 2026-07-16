# Analytics

Two pipelines, one job each: Umami answers questions about the site — who visits, from where, which
pages, whether acquisition converts — and Tinybird carries the behavioural product-event stream,
what players do once they're in. The dividing test: data that would ever be joined to a user or
avatar is a product event; data about the site is web analytics.

## Web analytics (Umami)

Umami is self-hosted on Fly (`apps/umami`, deployed as `vers-umami`) with its data in a dedicated
database in the shared Neon project. It is cookieless — visitor identity is a salted hash that
rotates daily — so it needs no consent banner and cannot reconstruct a visitor across days.

The web app injects the tracker from its root route when a website ID is baked into the client
bundle (`VITE_UMAMI_WEBSITE_ID`); non-production builds omit it, so dev, test, and e2e traffic never
reaches analytics. The tracker and its beacons ride same-origin paths (`/site.js`, `/site/api/send`)
answered by the analytics proxy in `app-web`'s server middleware, which forwards to the deployment
(`UMAMI_URL`) and stamps the visitor's address into `x-vers-client-ip` for geolocation. First-party
paths with neutral names keep the tracker off ad-blocker lists that match Umami's default script
name and third-party analytics origins.

Route changes auto-track as pageviews through the tracker's History API hooks. A play session parked
on one route for hours reads as a single pageview — gameplay engagement is a product-analytics
question, and pageview counts are not bent toward answering it.

## Events

Analytics events are a small curated set: anonymous, no payload, named in the `AnalyticsEventName`
union (`apps/web/src/lib/send-analytics-event.ts`) and fired through `sendAnalyticsEvent` at each
flow's confirmed completion. The set covers the acquisition funnel:

- `signup-complete`
- `onboarding-complete`
- `avatar-created`

The funnel report — landing pageview through the three events — is assembled in the Umami UI. A new
player-facing flow worth measuring adds its event name to the union and fires it where the flow
confirms success; element-level clicks can instead carry a `data-umami-event` attribute.

## Privacy stance

- No PII crosses into analytics — no emails, user IDs, avatar names, or free-text input.
- Umami's `identify()` API stays unused: linking a visitor to an account converts anonymous traffic
  measurement into user tracking.
- Session replay and heatmaps stay off: recording interactions and DOM snapshots cuts against the
  reason a cookieless tracker was chosen, and the snapshots would land in the shared Neon project.
- `DISABLE_TELEMETRY` keeps Umami's own anonymous usage pings off the wire.
