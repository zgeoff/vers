# Analytics

Two pipelines, one job each: Umami answers questions about the site — who visits, from where, which
pages, whether acquisition converts — and Tinybird carries the behavioural product-event stream,
what players do once they're in. The dividing test: data that would ever be joined to a user or
avatar is a product event; data about the site is web analytics.

## Web analytics (Umami)

Umami is self-hosted on Fly (`apps/umami`, deployed as `vers-umami`) with its data in a dedicated
database in the shared Neon project. It is cookieless — visitor identity is a salted hash that
rotates daily, so the tracker stores nothing on the device and cannot reconstruct a visitor across
days.

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

### Events

Analytics events are a small curated set: anonymous, no payload, named in the `AnalyticsEventName`
union (`apps/web/src/lib/send-analytics-event.ts`) and fired through `sendAnalyticsEvent` at each
flow's confirmed completion. The set covers the acquisition funnel:

- `signup-complete`
- `onboarding-complete`
- `avatar-created`

The funnel report — landing pageview through the three events — is assembled in the Umami UI. A new
player-facing flow worth measuring adds its event name to the union and fires it where the flow
confirms success; element-level clicks can instead carry a `data-umami-event` attribute.

### Privacy stance

- Events and pageviews carry no PII — no emails, user IDs, avatar names, or free-text input. The
  visitor's address reaches Umami only to derive coarse geolocation and the daily visitor hash;
  Umami stores the derived values, never the address itself.
- Umami's `identify()` API stays unused: linking a visitor to an account converts anonymous traffic
  measurement into user tracking.
- Session replay and heatmaps stay off: recording interactions and DOM snapshots cuts against the
  reason a cookieless tracker was chosen, and the snapshots would land in the shared Neon project.
- `DISABLE_TELEMETRY` keeps Umami's own anonymous usage pings off the wire.

## Product analytics (Tinybird)

Tinybird (managed ClickHouse) holds the behavioural product-event stream and serves it back as SQL
query endpoints. The repo owns the workspace's resources as datafiles in `infra/tinybird` — the
`product_events` data source and the query pipes — deployed from that directory with the Tinybird
CLI.

### Ingest

A game flow fires `emitProductEvent` (`apps/web/src/lib/product-events/emit-product-event.ts`),
which dispatches the event to a server function. The server validates the payload against the
registry schema, resolves the caller's session, and stamps `user_id` and `session_id` from it —
identity never comes from the client payload, and an unauthenticated caller's event is dropped. The
stamped row reaches the Events API through `@vers/product-analytics`
(`libs/service/product-analytics`), the same sender a service emitting domain events uses.

Delivery is best-effort and single-row: a failed or slow send is logged and dropped, never retried
and never blocking a flow. Environments without the Tinybird env keys deliver nothing — dev, test,
and e2e traffic never reaches analytics.

### Event registry

Event names are snake_case `noun_pastparticiple`; properties are ids of the entities the event is
about. Every event addition lands with its row here, its entry in the `@vers/product-analytics`
types, its arm in app-web's ingest schema, and any new column in the `product_events` data source —
all in the same PR.

| Event                | Properties               | Fired when                                                                             |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `session_started`    | —                        | once per page load, when the game shell is live (worker initialized, avatar known)     |
| `node_explored`      | `node_id`                | the player commits a selected world-map node into the encounter view                   |
| `activity_started`   | `activity_id`, `node_id` | the service confirms a fresh activity start; attaching to an existing run stays silent |
| `activity_completed` | `activity_id`            | the idle worker broadcasts an activity's completed checkpoint                          |

Worker-broadcast events reach every connected tab, so a multi-tab player can land
`activity_completed` once per tab; funnel endpoints count distinct users and are unaffected.

### Tokens and env

- `TINYBIRD_URL` and `TINYBIRD_INGEST_TOKEN` — the workspace region's Events API origin and a token
  scoped to append on `product_events` — are Fly secrets on the web app; either one absent disables
  delivery.
- Query endpoints authenticate with the read token the pipe deploy creates
  (`product_analytics_read`).
- The workspace admin token lives in the `vers` 1Password vault (`tinybird` item).

### Privacy

Product events are joined to accounts by design — that is the stream's purpose — but carry nothing
beyond the identity keys and entity ids: no emails, no avatar or display names, no free-text input.
Traffic measurement stays in the anonymous web-analytics stream; the two are never joined.
