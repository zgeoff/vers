# Deployment

Where the stack runs, how a merge reaches production, and how to re-provision it from nothing — read
this when shipping a release, provisioning the stack, or diagnosing a rollout. The stack is a Fly.io
fleet, deployed by the repo's deploy CLI from the `deploy.config.ts` manifest. Every rollout
decision keys off one marker: the `GIT_SHA` stamped into each app's machine env, compared against
HEAD. A leg that a failure skipped therefore reads stale and ships on the next push.

## Topology

The stack runs on Fly.io in the `syd` region. Three apps hold public addresses; the domain services
(every `services/*` app) are private, reachable only across the organization's 6PN WireGuard mesh.

- `app-web` — the user-facing edge.
- `vers-bugsink` (`apps/bugsink`) — the error tracker; public because browsers post error envelopes
  directly to it.
- `vers-umami` (`apps/umami`) — the web-analytics dashboard; tracker traffic instead arrives through
  `app-web`'s same-origin proxy ([analytics](./analytics.md)).

Postgres is a Neon project ([database](./database.md)); no app runs its own database, Bugsink
included. `service-keys` holds no database connection — its state is the `ROLL_KEY_ROOTS` secret
alone.

Every app scales to zero. `auto_stop_machines = 'suspend'` parks an idle machine with its memory
snapshot for sub-second wake, and a service wakes on its first request. Two deviations:

- `app-web` and `service-replay` keep one machine warm (`min_machines_running = 1`, enforced by
  `deploy verify` through the manifest's `minStartedMachines`): `app-web` so a visitor never waits
  on a cold start, and `service-replay` because its poll-driven worker receives no inbound requests
  and would stop claiming chains the moment its machines suspend.
- `service-email` stops rather than suspends (`auto_stop_machines = 'stop'`) — the queue-hosting
  policy ([queues](./queues.md)).

## Networking

`app-web` reaches a service at `http://<app>.flycast` — a private address that load-balances across
the service's machines and wakes a suspended one on demand. These URLs live in `app-web`'s
`fly.toml` `[env]`. A service is allocated no public IP, so nothing outside the mesh can reach it.
Mesh traffic is already encrypted, so services set `force_https = false`.

## Secrets

Non-sensitive config (service URLs, `NODE_ENV`, log level) lives in each `fly.toml` or Dockerfile.
Secrets are set with `fly secrets set` and never committed. Which variables an app needs is its env
contract's to declare, and each project's README renders that contract as a generated table
(`bun run readme:sync`, checked in CI) — [provision from nothing](#provision-from-nothing) sets the
current values:

- A service requires the base schema (`BASE_ENV_SCHEMA`, `@vers/service-runtime`) plus its own shape
  — `services/<name>/src/<name>-env-shape.ts`.
- `app-web`'s keys are the schema in `apps/web/src/server/web-env-schema.ts` plus the cookie
  config's `SESSION_SECRET` and `COOKIE_DOMAIN` reads (`apps/web/src/lib/auth/`).
- `vers-bugsink` and `vers-umami` read their upstream images' documented env. Bugsink additionally
  reads the `R2_*` keys in `apps/bugsink/r2_storage.py`, which back its uploaded-file storage.

`SERVICE_AUTH_PUBLIC_KEY` and `SERVICE_AUTH_PRIVATE_KEY` are one Ed25519 keypair: the SPKI public
key every service verifies inbound calls with, and the PKCS8 private half that signs outbound s2s
tokens ([auth](./auth.md)). Two callers hold the private half: `app-web` toward the domain services,
and `service-replay`'s worker toward version-pinned replay providers. Each token's `aud` is the
target's registered service name (`service-user`). Both signers hold the same key deliberately.
Verification checks signature, `iss`, and `aud` only, so any holder can mint a token for any service
— the private half is confined to first-party callers, and a per-caller key split buys nothing until
a caller with narrower trust exists.

The remaining keys with cross-service meaning:

- `JWT_SIGNING_PRIVKEY` — the RS256 PKCS8 private key `service-session` signs user tokens with,
  under issuer and audience `API_IDENTIFIER`.
- `ROLL_KEY_ROOTS` — `service-keys`' root-secret payload: JSON, one entry per population, each
  holding its current key version and every hex-encoded root version still derived against
  ([game-entropy](./game-entropy.md)).
- `SENTRY_DSN` — optional on any app, naming its Bugsink project; reporting behavior is
  [error-handling](./error-handling.md)'s.
- `OTEL_EXPORTER_OTLP_*` — the standard OTel export vars, optional on any app and set fleet-wide in
  practice ([provision from nothing](#provision-from-nothing)); the export path and per-signal
  header routing are [observability](./observability.md)'s.

The browser-side values ride GitHub Actions configuration. The deploy workflow bakes the
`VITE_SENTRY_DSN` Actions variable into `app-web`'s client bundle. The same value is also set as a
`vers-app-web` secret so the runtime can allow the ingest origin in its CSP. Source-map uploads
authenticate with the `SENTRY_AUTH_TOKEN` GitHub secret, a Bugsink API token; when it's unset the
build skips source maps entirely. The workflow bakes the `VITE_UMAMI_WEBSITE_ID` Actions variable
the same way; a bundle without it ships no analytics tracker ([analytics](./analytics.md)).

## Release

A push to `main` runs `.github/workflows/main.yml`; once the checks pass, the pipeline migrates the
database, builds every stale app, gates the combined fleet, and cuts over.

### Pipeline

Neon migrations apply once, in their own never-cancelled `migrate` job — several services share the
one database, so migration never runs per service. Database migrations are never rolled back: a
release must tolerate every migration applied after it shipped (expand/contract), which is what
makes redeploying a previous image safe.

Two per-app matrix jobs run the deploy CLI through the `.github/actions/fly-deploy` composite
action: `build` (`bun run deploy -- build --app <name>`) as soon as checks are green, and `deploy`
(`bun run deploy -- cutover --app <name>`) after `migrate`, `build`, and the full-stack suite. Both
matrices derive from `deploy.config.ts` via a `manifest` job (the CLI's `list` command), so adding
an app to the manifest is the whole change. Each leg self-gates: the CLI compares HEAD against the
`GIT_SHA` stamped on the app's machines, so a phase lost to an earlier failure ships on the next
push. The `build` job orders the later phases without gating them directly; an app's failed build
leaves its ref unavailable to `stack-e2e`, whose fleet-wide failure holds every cutover.

### Full-stack gate

Between build and cutover, the `stack-e2e` job boots every deployable image in a compose stack
(`apps/web-e2e/docker-compose.stack.yml`): every service image, `app-web`'s production image,
postgres, and a capture-only Resend stub. It resolves refs with the CLI's `images` command, migrates
the stack's own database, and drives the signup, verification, onboarding, and login journeys
(`apps/web-e2e/stack/`) against it. This gate is fleet-wide by design: a combined state that fails
its journeys ships for no app.

### Build and cutover

A stale build leg runs `flyctl deploy --build-only --push` on Fly's remote builder, so no image blob
crosses from the GitHub runner. The leg pushes the image as
`registry.fly.io/<app>:deployment-<sha>`. Both phases derive the tag from the commit, so no ref
travels between the jobs. Re-running a leg overwrites its own tag instead of minting a new artifact.

A stale cutover leg deploys that pushed ref (`flyctl deploy --image`), waits for the fleet to report
the new SHA, then runs the app's post-deploy probes from `deploy.config.ts`. An app with no
Dockerfile (`vers-umami`) has no build leg work and cuts over to the image named in its `fly.toml`.
For a manual rollout, the CLI's `deploy` command runs both phases in one invocation. The CLI's
`images` command prints each buildable app's deployable ref for HEAD as JSON:

- the commit-derived tag when the app is stale;
- the newest recorded release otherwise;
- the fleet's resolved image for an app with no recorded release yet.

### Release record and rollback

A rollout whose probes pass is recorded in the `releases` table: app, commit SHA, image ref, and the
digest the fleet resolved it to. The newest row per app is that app's rollback target. The cutover
legs require `DATABASE_URL` for this record.

A rollout whose probes fail rolls back: the CLI redeploys the app's newest recorded release,
restamping that release's own `GIT_SHA` so the fleet reads stale against HEAD and the next push
ships the fix. The leg still fails — rollback restores service, it never greens the run. A failed
rollout is never recorded. An app with no recorded release yet is left serving the broken release,
reported in the leg's log. Probes that fail on the restored release too mean the fault predates the
rollout; the leg reports that and leaves the fleet on the restored release.

### Fleet verification

`verify-fleet` runs on every green push — even when every deploy leg skipped — and asserts every
manifest app is online and current, catching an app at zero machines or a fleet behind HEAD. A
rolled-back app reads stale there by design.

### Scheduled machines

A `fly machine run --schedule` machine is unmanaged: `fly deploy` never rolls its image forward. An
app entry's `scheduledMachines` in `deploy.config.ts` declares each one (name, command, schedule,
region). The CLI reconciles the declarations right after the app's rollout lands, and on its
skipped-deploy path alike — creating a declared machine that doesn't exist yet on the app's
just-deployed image, and moving one on a stale image onto it. Provisioning a new scheduled machine
is a manifest edit; creation happens on the app's next deploy, not a manual `fly machine run`.
`verify-fleet` reds if a declared scheduled machine is missing or drifts onto a different image than
the app's service machines.

### Rollout strategies

`app-web` rolls out `bluegreen` — a full parallel fleet passes `/health` before traffic cuts over —
because it is the user-facing app. Services use `rolling` with `max_unavailable = 1`: a broken boot
fails the health gate with the old machine still up. Deploy jobs queue rather than cancel — killing
flyctl mid-bluegreen strands the green machines and fails every later deploy with "found multiple
image versions".

A rollout can fail on transient `syd` host-capacity refusals ("could not reserve resource"); Fly
rolls back cleanly, so re-run the failed job.

### Pinned upstream images

`vers-bugsink` and `vers-umami` ship pinned upstream images. Neither sits in the turbo task graph,
so their staleness triggers in `deploy.config.ts` are path globs (`apps/bugsink/**`,
`apps/umami/**`) rather than turbo affectedness. Upgrading either is a tag bump. Bugsink's is the
`Dockerfile` `FROM` line — its image is a thin layer over stock Bugsink adding the R2 uploaded-file
storage, baked by its build leg like any other app's. Umami's is the `fly.toml` `[build]` image,
deployed with no build leg at all.

## Infra drift

`.github/workflows/infra-drift.yml` runs `pulumi preview --refresh --expect-no-changes` over the
`infra/` program's `prod` stack and fails on any diff. It runs on pull requests and `main` pushes
touching `infra/` or the workflow file itself, and on a weekly schedule — console drift arrives with
no commit, so only the schedule can catch it. A pull request gets the preview as a PR comment. Fork
pull requests are skipped: GitHub withholds secrets from them, so the preview cannot authenticate.

The job authenticates through the `OP_SERVICE_ACCOUNT_TOKEN` repo secret — a non-expiring 1Password
service account scoped to read only the `vers-ci` vault — and resolves the stack's credentials from
their `op://` references at run time. `vers-ci` holds exactly the items the workflow's `op://`
references name, so a compromised job step cannot reach the signing keys, database URLs, and other
credentials in the `vers` vault. When the job gains a new credential, its item moves into `vers-ci`
— never a copy, which rots on rotation — and everything the job does not read stays in `vers`.

The job only ever previews — reconciling a reported drift is a human decision, applied with
`pulumi up` from a checkout.

## Sim-version registry

`vers-service-replay` serves deterministic replay for one sim engine build per request. Multiple
engine builds can be live in production at once, each answered by its own per-version provider app.
The deploy CLI computes the engine hash host-side: a sha256 digest over the pure replay entrypoint's
bundled output plus the pinned Bun version (`bun run deploy -- engine-hash`). The CLI passes the
hash as the `SIM_ENGINE_HASH` and `VITE_SIM_ENGINE_HASH` build args to `vers-service-replay` and
`vers-app-web` respectively, so both bake the same value into their compiled output.

After `vers-service-replay` deploys, and on its skipped-deploy path alike, the CLI reconciles the
`sim_versions` table against the fleet's just-deployed image. A hash with no existing provider app
gets one: `vers-replay-<hash12>` (the engine hash's first 12 hex characters), a private flycast IPv6
address, and a machine launched from `vers-service-replay`'s current deployment tag. Provisioning
always launches by tag — `flyctl machine run` mangles a `@sha256:` digest reference — and records
the digest `machines list --json` resolves it to separately. The registry row stores that
digest-pinned image ref and the provider app's flycast URL. The row refreshes whenever the fleet's
resolved digest differs from what's stored, even when the provider app itself needs no change.

Pruning stale provider apps and expired registry rows is a separate sweep's job — the deploy CLI
only ever creates and refreshes.

### Retention sweep

A registry row's `retained_until` (30 days past its deploy by default) is when its version stops
being a valid replay target, not when it disappears. `.github/workflows/replay-retention.yml` runs
`bun scripts/src/bin/deploy.ts sweep-replay` daily, and it never deletes a `sim_versions` row.
Deleting would collapse a distinction dispatch depends on. A version whose row is `pruned` is
`expired`: the client must resync onto the current version. A hash with no row at all is
`unknownVersion`: the activity parks until an operator or a later deploy registers it. The sweep
instead tombstones, flipping every `active` row past `retained_until` to `pruned` in one statement.
The current version — the newest `active` row by `deployed_at` — is excluded regardless of its own
`retained_until`: a live version is never a valid tombstone target no matter how old its deploy.

Only after a row is tombstoned does the sweep destroy its provider app
(`flyctl apps destroy <app> --yes`). That order is deliberate: a pruned row with a still-running app
is harmless — dispatch already reports it `expired` — while an app destroyed before its row flips
would leave an `active` row pointing at nothing. The sweep finishes by unparking every activity
whose stamped hash the registry now carries as `active`, so an activity parked while its version was
unregistered becomes replayable again once a later deploy provisions it, without waiting on the
client to resync.

The sweep is idempotent: a repeat run tombstones nothing already `pruned`, destroys nothing already
gone, and unparks nothing already `active`.

## Container builds

Fly's remote builder builds every server image from the app's Dockerfile. A shared `pruner` stage
cuts the workspace to the target's dependency graph; the later stages install, build, and assemble a
minimal runtime.

The `pruner` stage runs a standalone `turbo` binary (`bun add --global turbo`, no workspace install
needed) and `turbo prune <pkg> --docker`. Of prune's output, only `out/full` — the pruned source —
feeds a later stage. The pruned lockfile goes unused: bun re-resolves the smaller workspace's
hoisting and fails `--frozen-lockfile` (turborepo#11007). The stage instead copies every workspace
`package.json` plus the committed root `bun.lock`, `bunfig.toml`, and `patches/` into `/manifests`,
and the install stages read that. Each `bun install` layer mounts a BuildKit cache
(`--mount=type=cache,target=/root/.bun/install/cache`) to reuse the package cache across builds.

### Services

Every domain service carries its own Dockerfile stamped from one shared shape, compiling the service
to a single executable:

- **pruner** — the shared prune stage.
- **builder** — installs the service's graph from `/manifests`, copies the pruned source, and runs
  `bun build src/serve.ts --compile --target=bun-linux-x64-musl` to inline every JS import —
  workspace source and external deps — into one binary. The services carry no native addons, so the
  binary is standalone.
- **runtime** — `alpine` with `libgcc` and `libstdc++` (bun's musl binary links against them) and
  the binary alone, run as `nobody`. No `node_modules`, no source; the busybox shell keeps
  `fly ssh console` usable.

Two Dockerfiles deviate from the shape:

- `service-email`'s builder compiles a second `sweep` binary, the command its hourly scheduled
  machine runs ([queues](./queues.md)).
- `service-replay`'s builder takes the `SIM_ENGINE_HASH` build arg and bakes it into the compiled
  binary.

### app-web

`app-web` bundles an SSR server across five stages:

- **pruner** — the shared prune stage.
- **installer** — a full install of `@vers/web` plus `@vers/source` (the root manifest, carrying the
  build tooling: turbo and the base tsconfig), devDependencies included.
- **builder** — copies the pruned source and `tsconfig.base.json`, which lives outside any package,
  then runs codegen, typegen, and the vite production build. The stage adds `ca-certificates`
  because sentry-cli's sourcemap upload reads the system CA store the slim base omits. Build args
  `SENTRY_AUTH_TOKEN` and `VITE_SENTRY_DSN` bake the browser DSN into the bundle and authenticate
  the sourcemap upload.
- **prod-deps** — a production-only install with the hoisted linker, so the SSR bundle resolves
  every runtime import from one flat `node_modules` regardless of directory depth.
- **runtime** — `node:24.18.0-alpine` holding `node_modules`, `server.mjs`, and `dist`.

## Provision from nothing

Requires `flyctl` authenticated to the `vers` org, the Neon `DATABASE_URL` (the direct host —
[database](./database.md)), and the domain in `$DOMAIN`.

1. Create the apps:

   ```sh
   for app in app-web service-activity service-avatar service-email service-keys service-replay service-session service-user service-verification; do
     fly apps create "vers-$app" --org vers
   done
   ```

2. Give `app-web` public addresses; give each service a private Flycast address and no public IP:

   ```sh
   fly ips allocate-v4 --shared -a vers-app-web
   fly ips allocate-v6 -a vers-app-web
   for svc in activity avatar keys replay session user verification; do
     fly ips allocate-v6 --private -a "vers-service-$svc"
   done
   ```

3. Mint the CI deploy token and store it for the workflow:

   ```sh
   fly tokens create deploy --name github-ci | gh secret set FLY_API_TOKEN
   ```

4. Generate the keys and set each app's secrets. The s2s public key also goes into the `vers`
   1Password vault (`s2s-auth` item, `public-key` field): provisioning a single service later reads
   it with `op read 'op://vers/s2s-auth/public-key'`. The generated key files are deleted once the
   secrets are set, so the deployed value lives only in Fly's secret store. The Tinybird pair — the
   Events API origin and the `product_events` append token ([analytics](./analytics.md)) — comes
   from the `tinybird` item in the `vers` 1Password vault.

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

5. Stand up the error tracker. The first deploy is by hand; CI redeploys it on later config changes.
   `--ha=false` keeps the app to one machine — Fly otherwise creates a pair on first deploy. The
   admin credentials live on the `bugsink` item in the `vers` 1Password vault, the same item that
   later carries the MCP token.

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

6. In the Bugsink UI:

   - Create one project per app and set each project's DSN as that app's `SENTRY_DSN` secret.
   - Set the web project's DSN as the `VITE_SENTRY_DSN` GitHub Actions variable plus a
     `vers-app-web` secret of the same name.
   - Add the alarms Discord webhook (the `bugsink-discord-webhook` item in the `vers` 1Password
     vault) as each project's messaging service, so new-issue alerts reach the alarms channel.
   - Mint an API token for CI source-map uploads (`SENTRY_AUTH_TOKEN` GitHub secret) and one for the
     MCP server, added to the vault item as `mcp-token`.

7. Stand up web analytics. The first deploy is by hand; CI redeploys it on later config changes.
   Umami boots with an `admin`/`umami` account, so the rotation to the vault value runs in the same
   block — the stock credential is live from first boot until it does:

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

8. In the Umami UI, create the `vers` website and set its ID as the `VITE_UMAMI_WEBSITE_ID` GitHub
   Actions variable, then assemble the acquisition funnel report over the tracked events
   ([analytics](./analytics.md)).

9. Stand up the telemetry backend. The Axiom account is created in its UI, along with one
   console-minted credential that bootstraps the rest: the `iac-token` field on the `vers-ci`
   vault's `axiom` item, the Pulumi provider's API token, with the scopes listed in
   `infra/README.md`. Every other Axiom resource is provisioned by the `infra/` Pulumi program
   (`bun run up` in `infra/`); the resource registry and drift stance live in
   [observability](./observability.md). Token secret values sit on the `axiom` item in the `vers`
   1Password vault (`ingest-token`, `mcp-token`). A scope change in the program regenerates a
   token's value, and the vault field plus the fleet's staged OTel secrets must be updated within
   the 48-hour rotation grace window. Destructive administration outside the program uses a
   short-lived token minted in the UI with the needed scopes and revoked when the work is done.

   Point the fleet at the datasets:

   ```sh
   INGEST="$(op read 'op://vers/axiom/ingest-token')"
   for app in vers-app-web vers-service-activity vers-service-avatar vers-service-email vers-service-keys vers-service-replay vers-service-session vers-service-user vers-service-verification; do
     fly secrets set -a "$app" --stage \
       OTEL_EXPORTER_OTLP_ENDPOINT="https://api.axiom.co" \
       OTEL_EXPORTER_OTLP_TRACES_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Dataset=vers-traces" \
       OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Dataset=vers-logs" \
       OTEL_EXPORTER_OTLP_METRICS_HEADERS="Authorization=Bearer ${INGEST},X-Axiom-Metrics-Dataset=vers-metrics"
   done
   ```

Agent access goes through the hosted MCP server (`https://mcp.axiom.co/mcp`, OAuth) declared in
`.mcp.json`. The next push to `main` fills the machines.

## Teardown

```sh
for app in app-web bugsink umami service-activity service-avatar service-email service-keys service-replay service-session service-user service-verification; do
  fly apps destroy "vers-$app" --yes
done
```

Destroying an app releases its IPs and secrets. The Neon project and the domain outlive it.
