# Deployment

Where the stack runs, how a merge reaches production, and how to re-provision it from nothing.

## Topology

The stack runs on Fly.io in the `syd` region. `app-web`, `vers-bugsink` (the error tracker,
`apps/bugsink` — public because browsers post error envelopes directly to it), and `vers-umami` (the
web-analytics dashboard, `apps/umami` — tracker traffic instead arrives through `app-web`'s
same-origin proxy) hold the public addresses. The domain services — `service-activity`,
`service-avatar`, `service-keys`, `service-session`, `service-user`, `service-verification` — are
private, reachable only across the organization's 6PN WireGuard mesh. Postgres is a Neon project
(see [database](./database.md)); no app runs its own database, Bugsink included. `service-keys`
holds no database connection — its state is the `ROLL_KEY_ROOTS` secret alone.

Every app scales to zero. `auto_stop_machines = 'suspend'` parks an idle machine with its memory
snapshot for sub-second wake. `app-web` keeps one machine warm (`min_machines_running = 1`) so a
visitor never waits on a cold start; a service wakes on its first request.

## Networking

`app-web` reaches a service at `http://<app>.flycast` — a private address that load-balances across
the service's machines and wakes a suspended one on demand. These URLs live in `app-web`'s
`fly.toml` `[env]`. A service is allocated no public IP, so nothing outside the mesh can reach it,
and mesh traffic is already encrypted, so services set `force_https = false`.

## Secrets

Non-sensitive config (service URLs, `NODE_ENV`, log level) lives in each `fly.toml` or Dockerfile.
Secrets are set with `fly secrets set` and never committed.

| App                                                                          | Secrets                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `service-activity`, `service-avatar`, `service-user`, `service-verification` | `DATABASE_URL`, `SERVICE_AUTH_PUBLIC_KEY`                                                              |
| `service-session`                                                            | the above + `API_IDENTIFIER`, `JWT_SIGNING_PRIVKEY`                                                    |
| `service-replay`                                                             | `DATABASE_URL`, `SERVICE_AUTH_PUBLIC_KEY`, `SERVICE_AUTH_PRIVATE_KEY`                                  |
| `service-keys`                                                               | `ROLL_KEY_ROOTS`, `SERVICE_AUTH_PUBLIC_KEY`                                                            |
| `app-web`                                                                    | `SESSION_SECRET`, `COOKIE_DOMAIN`, `SERVICE_AUTH_PRIVATE_KEY`, `TINYBIRD_URL`, `TINYBIRD_INGEST_TOKEN` |
| `vers-bugsink`                                                               | `SECRET_KEY`, `DATABASE_URL`, `CREATE_SUPERUSER` (first boot)                                          |
| `vers-umami`                                                                 | `APP_SECRET`, `DATABASE_URL`                                                                           |

- `SERVICE_AUTH_PUBLIC_KEY` — Ed25519 SPKI public key a service verifies inbound calls with.
- `SERVICE_AUTH_PRIVATE_KEY` — its PKCS8 private half, held by the callers that sign outbound s2s
  tokens: `app-web` toward the domain services, and `service-replay`'s worker toward version-pinned
  replay providers. Each token's `aud` is the target's registered service name (`service-user`).
  Both signers hold the same key deliberately: verification checks signature, `iss`, and `aud` only,
  so any holder can mint a token for any service — the private half is confined to first-party
  callers, and a per-caller key split buys nothing until a caller with narrower trust exists.
- `JWT_SIGNING_PRIVKEY` — RS256 PKCS8 private key `service-session` signs user tokens with, under
  issuer and audience `API_IDENTIFIER`.
- `SESSION_SECRET` — seals `app-web`'s cookies.
- `TINYBIRD_URL` / `TINYBIRD_INGEST_TOKEN` — the product-analytics Events API origin and a token
  scoped to append on the `product_events` data source; either one absent disables product-event
  delivery.
- `ROLL_KEY_ROOTS` — JSON payload of avatar roll-key root secrets, one entry per population, each
  holding its current key version and every hex-encoded root version `service-keys` still derives
  against.
- `SENTRY_DSN` — a per-app Bugsink project DSN, optional on any app.

Telemetry export rides the standard OTel env vars, optional on any app and set fleet-wide in
practice: `OTEL_EXPORTER_OTLP_ENDPOINT` carries the backend's base URL (`https://api.axiom.co`), and
`OTEL_EXPORTER_OTLP_TRACES_HEADERS` / `OTEL_EXPORTER_OTLP_LOGS_HEADERS` /
`OTEL_EXPORTER_OTLP_METRICS_HEADERS` each carry the ingest token plus that signal's dataset
(`Authorization=Bearer <token>,X-Axiom-Dataset=vers-traces`, `…X-Axiom-Dataset=vers-logs`, and
`…X-Axiom-Metrics-Dataset=vers-metrics` — metrics route by their own header name). A process with
the endpoint unset emits no telemetry. The browser's DSN rides the `VITE_SENTRY_DSN` GitHub Actions
variable: the deploy workflow bakes it into `app-web`'s client bundle, and the same value is set as
a `vers-app-web` secret so the runtime can allow the ingest origin in its CSP. Source-map uploads
authenticate with the `SENTRY_AUTH_TOKEN` GitHub secret — a Bugsink API token; when it's unset the
build skips source maps entirely. The deploy workflow bakes the `VITE_UMAMI_WEBSITE_ID` GitHub
Actions variable into `app-web`'s client bundle; when it's unset the bundle ships no analytics
tracker.

## Release

A push to `main` runs `.github/workflows/main.yml`. Once the checks pass, the pipeline migrates and
rolls out:

1. Neon migrations apply once, in their own never-cancelled `migrate` job — several services share
   the one database, so migration never runs per service.
2. A deploy matrix runs the deploy CLI (`bun run deploy -- deploy --app <name>`) per manifest app
   through the `.github/actions/fly-deploy` composite action. The matrix itself is derived from
   `deploy.config.ts` by a `manifest` job (the CLI's `list` command), so adding an app to the
   manifest is the whole change. Each leg self-gates: the CLI compares HEAD against the `GIT_SHA`
   stamped on the app's machines, so a rollout lost to an earlier failure ships on the next push.
   Images build on Fly's remote builder — no image blob crosses from the GitHub runner.
3. After deploying, the CLI waits for the fleet to report the new SHA, then runs the app's
   post-deploy probes from `deploy.config.ts`.
4. `verify-fleet` runs on every green push — even when every deploy leg skipped — and asserts every
   manifest app is online and current, catching an app at zero machines or a fleet behind HEAD.

A `fly machine run --schedule` machine is unmanaged: `fly deploy` never rolls its image forward. An
app entry's `scheduledMachines` in `deploy.config.ts` declares each one (name, command, schedule,
region), and the CLI reconciles them right after the app's rollout lands — creating a declared
machine that doesn't exist yet on the app's just-deployed image, and moving one on a stale image
onto it. Provisioning a new scheduled machine is a manifest edit; creation happens on the app's next
deploy, not a manual `fly machine run`. `verify-fleet` reds if a declared scheduled machine is
missing or drifts onto a different image than the app's service machines.

`app-web` rolls out `bluegreen` — a full parallel fleet passes `/health` before traffic cuts over —
because it is the user-facing app. Services use `rolling` with `max_unavailable = 1`: a broken boot
fails the health gate with the old machine still up. Deploy jobs queue rather than cancel — killing
flyctl mid-bluegreen strands the green machines and fails every later deploy with "found multiple
image versions".

A rollout can fail on transient `syd` host-capacity refusals ("could not reserve resource"); Fly
rolls back cleanly, so re-run the failed job.

`vers-bugsink` and `vers-umami` deploy pinned stock images with no build. Neither sits in the turbo
task graph, so their staleness triggers in `deploy.config.ts` are path globs (`apps/bugsink/**`,
`apps/umami/**`) rather than turbo affectedness. Upgrading either is a tag bump — Bugsink on its
`Dockerfile` `FROM` line, Umami on its `fly.toml` `[build]` image.

## Sim-version registry

`vers-service-replay` serves deterministic replay for one sim engine build per request; multiple
engine builds can be live in production at once, each answered by its own per-version provider app.
The deploy CLI computes the engine hash host-side — a sha256 digest over the pure replay
entrypoint's bundled output plus the pinned Bun version (`bun run deploy -- engine-hash`) — and
passes it as the `SIM_ENGINE_HASH` and `VITE_SIM_ENGINE_HASH` build args to `vers-service-replay`
and `vers-app-web` respectively, so both bake the same value into their compiled output.

After `vers-service-replay` deploys, and on its skipped-deploy path alike, the CLI reconciles the
`sim_versions` table against the fleet's just-deployed image. A hash with no existing provider app
gets one: `vers-replay-<hash12>` (the engine hash's first 12 hex characters), a private flycast IPv6
address, and a machine launched from `vers-service-replay`'s current deployment tag —
`flyctl machine run` mangles a `@sha256:` digest reference, so provisioning always launches by tag
and records the digest `machines list --json` resolves it to separately. The registry row stores
that digest-pinned image ref and the provider app's flycast URL, and refreshes whenever the fleet's
resolved digest differs from what's stored, even when the provider app itself needs no change.

Pruning stale provider apps and expired registry rows is a separate sweep's job — the deploy CLI
only ever creates and refreshes.

### Retention sweep

A registry row's `retained_until` (30 days past its deploy by default) is when its version stops
being a valid replay target, not when it disappears: `.github/workflows/replay-retention.yml` runs
`bun scripts/src/bin/deploy.ts sweep-replay` daily, and it never deletes a `sim_versions` row.
Deleting would collapse a distinction dispatch depends on — a version whose row is `pruned` is
`expired` (the client must resync onto the current version), while a hash with no row at all is
`unknownVersion` (the activity parks until an operator or a later deploy registers it). The sweep
instead tombstones: it flips every `active` row past `retained_until` to `pruned` in one statement,
excluding the current version (the newest `active` row by `deployed_at`) regardless of its own
`retained_until` — a live version is never a valid tombstone target no matter how old its deploy.

Only after a row is tombstoned does the sweep destroy its provider app
(`flyctl apps destroy <app> --yes`). That order is deliberate: a pruned row with a still-running app
is harmless — dispatch already reports it `expired` — while an app destroyed before its row flips
would leave an `active` row pointing at nothing. The sweep finishes by unparking every activity
whose stamped hash the registry now carries as `active` — an activity parked while its version was
unregistered can become replayable again once a later deploy provisions it, without waiting on the
client to resync.

The sweep is idempotent: a repeat run tombstones nothing already `pruned`, destroys nothing already
gone, and unparks nothing already `active`.

## Container builds

Fly's remote builder builds every server image from the app's Dockerfile. A shared `pruner` stage
cuts the workspace to the target's dependency graph; the later stages install, build, and assemble a
minimal runtime.

The `pruner` stage runs a standalone `turbo` binary (`bun add --global turbo`, no workspace install
needed) and `turbo prune <pkg> --docker`, producing `out/json` (manifests only, for layer caching),
`out/full` (source), and a pruned lockfile. That pruned lockfile goes unused: bun re-resolves the
smaller workspace's hoisting and fails `--frozen-lockfile` (turborepo#11007). The stage instead
copies every workspace `package.json` plus the committed root `bun.lock` into `/manifests`, and the
install stages read that. Each `bun install` layer mounts a BuildKit cache
(`--mount=type=cache,target=/root/.bun/install/cache`) to reuse the package cache across builds.

### Services

`service-activity`, `service-avatar`, `service-keys`, `service-session`, `service-user`, and
`service-verification` share one Dockerfile, compiling to a single executable:

1. **pruner** — as above.
2. **builder** — installs the service's graph from `/manifests`, copies the pruned source, and runs
   `bun build src/serve.ts --compile --target=bun-linux-x64-musl` to inline every JS import —
   workspace source and external deps — into one binary. The services carry no native addons, so the
   binary is standalone.
3. **runtime** — `alpine` with `libgcc` and `libstdc++` (bun's musl binary links against them) and
   the binary alone, run as `nobody`. No `node_modules`, no source; the busybox shell keeps
   `fly ssh console` usable.

### app-web

`app-web` bundles an SSR server across five stages:

1. **pruner** — as above.
2. **installer** — a full install of `@vers/web` plus `@vers/source` (the root manifest, carrying
   the build tooling: turbo and the base tsconfig), devDependencies included.
3. **builder** — copies the pruned source and `tsconfig.base.json` (which lives outside any
   package), adds `ca-certificates` (sentry-cli's sourcemap upload reads the system CA store the
   slim base omits), then runs codegen, typegen, and the vite production build. Build args
   `SENTRY_AUTH_TOKEN` and `VITE_SENTRY_DSN` bake the browser DSN into the bundle and authenticate
   the sourcemap upload.
4. **prod-deps** — a production-only install with the hoisted linker, so the SSR bundle resolves
   every runtime import from one flat `node_modules` regardless of directory depth.
5. **runtime** — `node:24.18.0-alpine` holding `node_modules`, `server.mjs`, and `dist`.

## Provision from nothing

Requires `flyctl` authenticated to the `vers` org, the Neon pooled `DATABASE_URL`, and the domain in
`$DOMAIN`.

Create the apps:

```sh
for app in app-web service-activity service-avatar service-email service-keys service-replay service-session service-user service-verification; do
  fly apps create "vers-$app" --org vers
done
```

Give `app-web` public addresses; give each service a private Flycast address and no public IP:

```sh
fly ips allocate-v4 --shared -a vers-app-web
fly ips allocate-v6 -a vers-app-web
for svc in activity avatar keys replay session user verification; do
  fly ips allocate-v6 --private -a "vers-service-$svc"
done
```

Mint the CI deploy token and store it for the workflow:

```sh
fly tokens create deploy --name github-ci | gh secret set FLY_API_TOKEN
```

Generate the keys and set each app's secrets. The s2s public key also goes into the `vers` 1Password
vault (`s2s-auth` item, `public-key` field): provisioning a single service later reads it with
`op read 'op://vers/s2s-auth/public-key'` — the key files below are deleted, and the deployed value
lives only in Fly's secret store.

```sh
openssl genpkey -algorithm ed25519 -out s2s.key
openssl pkey -in s2s.key -pubout -out s2s.pub
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out session.key

op item create --vault vers --category "API Credential" --title s2s-auth \
  "public-key[text]=$(cat s2s.pub)"

for svc in activity avatar user verification; do
  fly secrets set -a "vers-service-$svc" \
    DATABASE_URL="$DATABASE_URL" \
    SERVICE_AUTH_PUBLIC_KEY="$(cat s2s.pub)"
done

fly secrets set -a vers-service-keys \
  SERVICE_AUTH_PUBLIC_KEY="$(cat s2s.pub)" \
  ROLL_KEY_ROOTS="$(jq -nc \
    --arg trade "$(openssl rand -hex 32)" \
    --arg selfFound "$(openssl rand -hex 32)" \
    '{trade: {current: 1, roots: {"1": $trade}}, "self-found": {current: 1, roots: {"1": $selfFound}}}')"

fly secrets set -a vers-service-session \
  DATABASE_URL="$DATABASE_URL" \
  SERVICE_AUTH_PUBLIC_KEY="$(cat s2s.pub)" \
  API_IDENTIFIER=vers-api \
  JWT_SIGNING_PRIVKEY="$(cat session.key)"

fly secrets set -a vers-service-replay \
  DATABASE_URL="$DATABASE_URL" \
  SERVICE_AUTH_PUBLIC_KEY="$(cat s2s.pub)" \
  SERVICE_AUTH_PRIVATE_KEY="$(cat s2s.key)"

fly secrets set -a vers-app-web \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  COOKIE_DOMAIN="$DOMAIN" \
  SERVICE_AUTH_PRIVATE_KEY="$(cat s2s.key)" \
  TINYBIRD_URL="$TINYBIRD_URL" \
  TINYBIRD_INGEST_TOKEN="$TINYBIRD_INGEST_TOKEN"

rm s2s.key s2s.pub session.key
```

The Tinybird pair — the Events API origin and the `product_events` append token — comes from the
`tinybird` item in the `vers` 1Password vault.

Stand up the error tracker. The first deploy is by hand; CI redeploys it on later config changes.
`--ha=false` keeps the app to one machine — Fly otherwise creates a pair on first deploy. The admin
credentials live on the `bugsink` item in the `vers` 1Password vault — the same item that later
carries the MCP token:

```sh
fly apps create vers-bugsink --org vers
fly ips allocate-v4 --shared -a vers-bugsink
fly ips allocate-v6 -a vers-bugsink

neonctl databases create --name bugsink

BUGSINK_ADMIN_PASSWORD="$(openssl rand -base64 16)"
op item create --vault vers --category login --title bugsink \
  --url https://vers-bugsink.fly.dev \
  "username=me@$DOMAIN" "password=$BUGSINK_ADMIN_PASSWORD"

fly secrets set -a vers-bugsink \
  SECRET_KEY="$(openssl rand -base64 50)" \
  DATABASE_URL="<the bugsink database's pooled connection URL>" \
  CREATE_SUPERUSER="me@$DOMAIN:$BUGSINK_ADMIN_PASSWORD"

fly deploy --config apps/bugsink/fly.toml --ha=false
fly secrets unset CREATE_SUPERUSER -a vers-bugsink
```

In the Bugsink UI, create one project per app, set each project's DSN as that app's `SENTRY_DSN`
secret, and set the web project's DSN as the `VITE_SENTRY_DSN` GitHub Actions variable plus a
`vers-app-web` secret of the same name. Add the alarms Discord webhook (the
`bugsink-discord-webhook` item in the `vers` 1Password vault) as each project's messaging service,
so new-issue alerts reach the alarms channel. Mint an API token for CI source-map uploads
(`SENTRY_AUTH_TOKEN` GitHub secret) and one for the MCP server, added to the vault item as
`mcp-token`.

Stand up web analytics. The first deploy is by hand; CI redeploys it on later config changes. Umami
boots with an `admin`/`umami` account, so the rotation to the vault value runs in the same block —
the stock credential is live from first boot until it does:

```sh
fly apps create vers-umami --org vers
fly ips allocate-v4 --shared -a vers-umami
fly ips allocate-v6 -a vers-umami

neonctl databases create --name umami

op item create --vault vers --category login --title umami \
  --url https://vers-umami.fly.dev \
  "username=admin" "password=$(openssl rand -base64 16)"

fly secrets set -a vers-umami \
  APP_SECRET="$(openssl rand -base64 32)" \
  DATABASE_URL="<the umami database's pooled connection URL>"

fly deploy --config apps/umami/fly.toml --ha=false

TOKEN=$(curl -s https://vers-umami.fly.dev/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"umami"}' | jq -r .token)
curl -s -X POST https://vers-umami.fly.dev/api/me/password \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"currentPassword\":\"umami\",\"newPassword\":\"$(op read 'op://vers/umami/password')\"}"
```

In the Umami UI, create the `vers` website and set its ID as the `VITE_UMAMI_WEBSITE_ID` GitHub
Actions variable, then assemble the acquisition funnel report over the tracked events
([analytics](./analytics.md)).

Stand up the telemetry backend. The Axiom account is created in its UI; its standing tokens live on
the `axiom` item in the `vers` 1Password vault: `ingest-token` (ingest on all datasets — the fleet's
export credential), `mcp-token` (query, for read-only investigation), and `admin-token` (an advanced
API token with create/read/update — never delete — on datasets, monitors, notifiers, and dashboards,
for agent-driven administration). Destructive administration (deleting any of those) uses a
short-lived token minted in the UI with the needed scopes and revoked when the work is done. Create
one dataset per signal and point the fleet at them — the metrics dataset needs the `otel:metrics:v1`
kind, since an events dataset rejects OTLP metrics ingest:

```sh
ADMIN="$(op read 'op://vers/axiom/admin-token')"
for ds in vers-traces vers-logs; do
  curl -sS --fail -X POST https://api.axiom.co/v1/datasets \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d "{\"name\":\"$ds\"}"
done
curl -sS --fail -X POST https://api.axiom.co/v2/datasets \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"name":"vers-metrics","kind":"otel:metrics:v1"}'

INGEST="$(op read 'op://vers/axiom/ingest-token')"
for app in vers-app-web vers-service-activity vers-service-avatar vers-service-email vers-service-keys vers-service-replay vers-service-session vers-service-user vers-service-verification; do
  fly secrets set -a "$app" --stage \
    OTEL_EXPORTER_OTLP_ENDPOINT="https://api.axiom.co" \
    OTEL_EXPORTER_OTLP_TRACES_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Dataset=vers-traces" \
    OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Dataset=vers-logs" \
    OTEL_EXPORTER_OTLP_METRICS_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Metrics-Dataset=vers-metrics"
done
```

The `vers services — baseline` dashboard (request rate, 5xx responses, and p95 latency per service,
plus an error-log stream) and the `vers 5xx responses` and `vers verification lag`
(`vers.verification.lag` over its threshold — `docs/architecture/observability.md`) threshold
monitors are created through the same API; the monitors notify the `vers alarms` notifier. Agent
access goes through the hosted MCP server (`https://mcp.axiom.co/mcp`, OAuth) declared in
`.mcp.json`.

The next push to `main` fills the machines.

## Teardown

```sh
for app in app-web bugsink umami service-activity service-avatar service-email service-keys service-replay service-session service-user service-verification; do
  fly apps destroy "vers-$app" --yes
done
```

Destroying an app releases its IPs and secrets. The Neon project and the domain outlive it.
