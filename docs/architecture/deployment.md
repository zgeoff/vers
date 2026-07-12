# Deployment

Where the stack runs, how a merge reaches production, and how to re-provision it from nothing.

## Topology

The stack runs on Fly.io in the `syd` region. `app-web` and `vers-bugsink` (the error tracker,
`apps/bugsink` — public because browsers post error envelopes directly to it) hold the public
addresses. The domain services — `service-activity`, `service-avatar`, `service-session`,
`service-user`, `service-verification` — are private, reachable only across the organization's 6PN
WireGuard mesh. Postgres is a Neon project (see [database](./database.md)); no app runs its own
database, Bugsink included.

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

| App                                                                          | Secrets                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `service-activity`, `service-avatar`, `service-user`, `service-verification` | `DATABASE_URL`, `SERVICE_AUTH_PUBLIC_KEY`                     |
| `service-session`                                                            | the above + `API_IDENTIFIER`, `JWT_SIGNING_PRIVKEY`           |
| `app-web`                                                                    | `SESSION_SECRET`, `COOKIE_DOMAIN`, `SERVICE_AUTH_PRIVATE_KEY` |
| `vers-bugsink`                                                               | `SECRET_KEY`, `DATABASE_URL`, `CREATE_SUPERUSER` (first boot) |

- `SERVICE_AUTH_PUBLIC_KEY` — Ed25519 SPKI public key a service verifies inbound calls with.
- `SERVICE_AUTH_PRIVATE_KEY` — its PKCS8 private half; `app-web` signs outbound s2s tokens with it,
  each token's `aud` the target's registered service name (`service-user`).
- `JWT_SIGNING_PRIVKEY` — RS256 PKCS8 private key `service-session` signs user tokens with, under
  issuer and audience `API_IDENTIFIER`.
- `SESSION_SECRET` — seals `app-web`'s cookies.
- `SENTRY_DSN` — a per-app Bugsink project DSN, optional on any app.

Telemetry export rides the standard OTel env vars, optional on any app and set fleet-wide in
practice: `OTEL_EXPORTER_OTLP_ENDPOINT` carries the backend's base URL (`https://api.axiom.co`), and
`OTEL_EXPORTER_OTLP_TRACES_HEADERS` / `OTEL_EXPORTER_OTLP_LOGS_HEADERS` each carry the ingest token
plus that signal's dataset (`Authorization=Bearer <token>,X-Axiom-Dataset=vers-traces` and
`…=vers-logs`). A process with the endpoint unset emits no telemetry. The browser's DSN rides the
`VITE_SENTRY_DSN` GitHub Actions variable: the deploy workflow bakes it into `app-web`'s client
bundle, and the same value is set as a `vers-app-web` secret so the runtime can allow the ingest
origin in its CSP. Source-map uploads authenticate with the `SENTRY_AUTH_TOKEN` GitHub secret — a
Bugsink API token; when it's unset the build skips source maps entirely.

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

`app-web` rolls out `bluegreen` — a full parallel fleet passes `/health` before traffic cuts over —
because it is the user-facing app. Services use `rolling` with `max_unavailable = 1`: a broken boot
fails the health gate with the old machine still up. Deploy jobs queue rather than cancel — killing
flyctl mid-bluegreen strands the green machines and fails every later deploy with "found multiple
image versions".

A rollout can fail on transient `syd` host-capacity refusals ("could not reserve resource"); Fly
rolls back cleanly, so re-run the failed job.

`vers-bugsink` deploys the pinned stock Bugsink image with no build. It isn't a workspace package,
so its staleness trigger in `deploy.config.ts` is a path glob (`apps/bugsink/**`) rather than turbo
affectedness. Upgrading Bugsink is a tag bump in its `fly.toml`.

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

`service-activity`, `service-avatar`, `service-session`, `service-user`, and `service-verification`
share one Dockerfile, compiling to a single executable:

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
for app in app-web service-activity service-avatar service-session service-user service-verification; do
  fly apps create "vers-$app" --org vers
done
```

Give `app-web` public addresses; give each service a private Flycast address and no public IP:

```sh
fly ips allocate-v4 --shared -a vers-app-web
fly ips allocate-v6 -a vers-app-web
for svc in activity avatar session user verification; do
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

fly secrets set -a vers-service-session \
  DATABASE_URL="$DATABASE_URL" \
  SERVICE_AUTH_PUBLIC_KEY="$(cat s2s.pub)" \
  API_IDENTIFIER=vers-api \
  JWT_SIGNING_PRIVKEY="$(cat session.key)"

fly secrets set -a vers-app-web \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  COOKIE_DOMAIN="$DOMAIN" \
  SERVICE_AUTH_PRIVATE_KEY="$(cat s2s.key)"

rm s2s.key s2s.pub session.key
```

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
`vers-app-web` secret of the same name. Mint an API token for CI source-map uploads
(`SENTRY_AUTH_TOKEN` GitHub secret) and one for the MCP server, added to the vault item as
`mcp-token`.

Stand up the telemetry backend. The Axiom account is created in its UI; its standing tokens live on
the `axiom` item in the `vers` 1Password vault: `ingest-token` (ingest on all datasets — the fleet's
export credential) and `mcp-token` (query, for read-only investigation). Administration — creating
datasets, dashboards, monitors, notifiers — uses a short-lived token minted in the UI with
management scopes and revoked when the work is done. Create one dataset per signal and point the
fleet at them:

```sh
ADMIN="<short-lived management token from the Axiom UI>"
for ds in vers-traces vers-logs; do
  curl -s -X POST https://api.axiom.co/v1/datasets \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d "{\"name\":\"$ds\"}"
done

INGEST="$(op read 'op://vers/axiom/ingest-token')"
for app in vers-app-web vers-service-activity vers-service-avatar vers-service-session vers-service-user vers-service-verification; do
  fly secrets set -a "$app" --stage \
    OTEL_EXPORTER_OTLP_ENDPOINT="https://api.axiom.co" \
    OTEL_EXPORTER_OTLP_TRACES_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Dataset=vers-traces" \
    OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Dataset=vers-logs"
done
```

The `vers services — baseline` dashboard (request rate, 5xx responses, and p95 latency per service,
plus an error-log stream) and the `vers 5xx responses` threshold monitor are created through the
same API; the monitor notifies the `vers alerts` notifier. Agent access goes through the hosted MCP
server (`https://mcp.axiom.co/mcp`, OAuth) declared in `.mcp.json`.

The next push to `main` fills the machines.

## Teardown

```sh
for app in app-web bugsink service-avatar service-session service-user service-verification; do
  fly apps destroy "vers-$app" --yes
done
```

Destroying an app releases its IPs and secrets. The Neon project and the domain outlive it.
