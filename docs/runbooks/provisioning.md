# Provisioning

The steps that stand the platform up from nothing and tear it down: the Neon project, the Fly fleet
and its secrets, and the roles agent sessions query through.
[Deployment](../architecture/platform/deployment.md) owns what a rollout does once the fleet exists;
[database](../architecture/platform/database.md) owns the Neon topology and connection rules.

## Neon project

The Pulumi program creates the Neon layer: project, branches, endpoints, roles. The database and its
connection string follow with neonctl, authenticated through `neonctl auth`:

```sh
cd infra && bun run up
neonctl databases create --project-id <new-id> --name vers --owner-name neondb_owner
neonctl connection-string main --project-id <new-id> --database-name vers
# then: rewrite sslmode to verify-full, drop channel_binding, and distribute to the consumer stores
```

After provisioning, write the string into `libs/data/db/.env.local`. Then `db:migrate` and `db:seed`
(run with `--env-file=.env.local`) bring the schema and dev seed data up from zero. Update the
`database-url` field on the `vers-ci` vault's `github-actions` item (the vers-infra program pushes
it to the `DATABASE_URL` Actions secret) and each Fly app's secret to the new string.

## Fly fleet

Requires `flyctl` authenticated to the `vers` org, the Neon `DATABASE_URL` (the direct host —
[database](../architecture/platform/database.md)), and the domain in `$DOMAIN`. Export `EMAIL_FROM`,
`RESEND_API_KEY`, `TINYBIRD_URL`, and `TINYBIRD_INGEST_TOKEN` from the `vers` vault before step 4:
an unset variable sets an empty secret, which `flyctl` accepts.

1. Create the apps:

   ```sh
   for app in app-web service-activity service-avatar service-email service-keys service-replay service-session service-user service-verification; do
     fly apps create "vers-$app" --org vers
   done
   ```

2. Give `app-web` its public addresses. The deploy CLI allocates a service's flycast address on its
   first rollout ([networking](../architecture/platform/deployment.md#networking)):

   ```sh
   fly ips allocate-v4 --shared -a vers-app-web
   fly ips allocate-v6 -a vers-app-web
   ```

3. Mint the CI deploy token and store it where the vers-infra program reads it (`infra/github.ts`
   pushes it to the `FLY_API_TOKEN` secret on its next `pulumi up`):

   ```sh
   fly tokens create org -o vers --name github-actions |
     op item edit github-actions --vault vers-ci 'fly-api-token[concealed]=-'
   ```

4. Generate the keys and set each app's secrets. Each minting issuer (`app-web`, `service-activity`,
   `service-replay`) gets its own Ed25519 keypair: the private half lands only in that app's
   secrets, and the public halves combine into the `SERVICE_AUTH_JWKS` every domain service verifies
   with. The JWKS also goes into the `vers` 1Password vault (`s2s-auth` item, `jwks` field):
   provisioning a single service later reads it with `op read 'op://vers/s2s-auth/jwks'`. The
   generated key files are deleted once the secrets are set, so the deployed private keys live only
   in Fly's secret store. The Tinybird pair — the Events API origin and the `product_events` append
   token ([analytics](../architecture/analytics.md)) — comes from the `tinybird` item in the `vers`
   1Password vault.

   ```sh
   set -euo pipefail

   for issuer in app-web service-activity service-replay; do
     openssl genpkey -algorithm ed25519 -out "s2s-$issuer.key"
   done
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out session.key

   SERVICE_AUTH_JWKS="$(bun -e '
     import { createPublicKey } from "node:crypto";
     import { readFileSync } from "node:fs";
     const keys = ["app-web", "service-activity", "service-replay"].map((kid) => ({
       ...createPublicKey(readFileSync(`s2s-${kid}.key`)).export({ format: "jwk" }),
       kid,
     }));
     console.log(JSON.stringify({ keys }));
   ')"

   op item create --vault vers --category "API Credential" --title s2s-auth \
     "jwks[text]=$SERVICE_AUTH_JWKS"

   for svc in avatar user verification; do
     fly secrets set -a "vers-service-$svc" \
       DATABASE_URL="$DATABASE_URL" \
       SERVICE_AUTH_JWKS="$SERVICE_AUTH_JWKS"
   done

   fly secrets set -a vers-service-email \
     DATABASE_URL="$DATABASE_URL" \
     SERVICE_AUTH_JWKS="$SERVICE_AUTH_JWKS" \
     EMAIL_FROM="$EMAIL_FROM" \
     RESEND_API_KEY="$RESEND_API_KEY"

   fly secrets set -a vers-service-activity \
     DATABASE_URL="$DATABASE_URL" \
     SERVICE_AUTH_JWKS="$SERVICE_AUTH_JWKS" \
     SERVICE_AUTH_PRIVATE_KEY="$(cat s2s-service-activity.key)"

   # Persisted rows reference root versions by number, so a rerun reuses the roots the `vers`
   # vault already holds. A rotation appends a new version and never overwrites an existing one.
   if op item get key-roots --vault vers >/dev/null 2>&1; then
     ROLL_KEY_ROOTS="$(op read 'op://vers/key-roots/roll-key-roots')"
     SCOPE_SECRET_ROOTS="$(op read 'op://vers/key-roots/scope-secret-roots')"
   else
     ROLL_KEY_ROOTS="$(jq -nc \
       --arg trade "$(openssl rand -hex 32)" \
       --arg selfFound "$(openssl rand -hex 32)" \
       '{trade: {current: 1, roots: {"1": $trade}}, "self-found": {current: 1, roots: {"1": $selfFound}}}')"
     SCOPE_SECRET_ROOTS="$(jq -nc \
       --arg worldmap "$(openssl rand -hex 32)" \
       '{worldmap: {current: 1, roots: {"1": $worldmap}}}')"

     op item create --vault vers --category "API Credential" --title key-roots \
       "roll-key-roots[concealed]=$ROLL_KEY_ROOTS" \
       "scope-secret-roots[concealed]=$SCOPE_SECRET_ROOTS"
   fi

   fly secrets set -a vers-service-keys \
     SERVICE_AUTH_JWKS="$SERVICE_AUTH_JWKS" \
     ROLL_KEY_ROOTS="$ROLL_KEY_ROOTS" \
     SCOPE_SECRET_ROOTS="$SCOPE_SECRET_ROOTS"

   fly secrets set -a vers-service-session \
     DATABASE_URL="$DATABASE_URL" \
     SERVICE_AUTH_JWKS="$SERVICE_AUTH_JWKS" \
     API_IDENTIFIER=vers-api \
     JWT_SIGNING_PRIVKEY="$(cat session.key)"

   fly secrets set -a vers-service-replay \
     DATABASE_URL="$DATABASE_URL" \
     SERVICE_AUTH_JWKS="$SERVICE_AUTH_JWKS" \
     SERVICE_AUTH_PRIVATE_KEY="$(cat s2s-service-replay.key)"

   fly secrets set -a vers-app-web \
     SESSION_SECRET="$(openssl rand -base64 32)" \
     COOKIE_DOMAIN="$DOMAIN" \
     SERVICE_AUTH_PRIVATE_KEY="$(cat s2s-app-web.key)" \
     TINYBIRD_URL="$TINYBIRD_URL" \
     TINYBIRD_INGEST_TOKEN="$TINYBIRD_INGEST_TOKEN"

   rm s2s-*.key session.key
   ```

5. Stand up the error tracker. The first deploy is by hand; CI redeploys it on later config changes.
   `--ha=false` keeps the app to one machine. Fly otherwise creates a pair on first deploy. The
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
   - Mint an API token for CI source-map uploads (the `sentry-auth-token` field on the `vers-ci`
     vault's `github-actions` item, pushed to the `SENTRY_AUTH_TOKEN` secret by the vers-infra
     program) and one for the MCP server, added to the `bugsink` vault item as `mcp-token`.

7. Stand up web analytics. The first deploy is by hand; CI redeploys it on later config changes.
   Umami boots with an `admin`/`umami` account, so the rotation to the vault value runs in the same
   block. The stock credential is live from first boot until the rotation lands:

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
   ([analytics](../architecture/analytics.md)).

9. Stand up the telemetry backend. The Axiom account is created in its UI, along with one
   console-minted credential that bootstraps the rest: the `iac-token` field on the `vers-ci`
   vault's `axiom` item, the Pulumi provider's API token, with the scopes listed in
   `infra/README.md`. Every other Axiom resource is provisioned by the `infra/` Pulumi program
   (`bun run up` in `infra/`); the resource registry and drift stance live in
   [observability](../architecture/platform/observability.md). Token secret values sit on the
   `axiom` item in the `vers` 1Password vault (`ingest-token`, `mcp-token`). A scope change in the
   program regenerates a token's value, and the vault field plus the fleet's staged OTel secrets
   must be updated within the 48-hour rotation grace window. Destructive administration outside the
   program uses a short-lived token minted in the UI with the needed scopes and revoked when the
   work is done.

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

## Agent database access

The `dev` branch and both roles come from the Pulumi program. Grants, passwords, and vault items
follow by hand.

1. Apply the program. It declares the `dev` branch and the `mcp_ro` and `mcp_dev` roles.

   ```sh
   cd infra && bun run up
   ```

2. Grant the read-only role as `neondb_owner` against `vers` on `main`.

   ```sql
   GRANT USAGE ON SCHEMA public TO mcp_ro;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_ro;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_ro;
   ALTER ROLE mcp_ro SET default_transaction_read_only = on;
   ```

3. Grant the dev role as `neondb_owner` against `vers` on `dev`.

   ```sql
   ALTER ROLE mcp_dev CREATEDB;
   ```

4. Mint each role's password (`neonctl roles reset-password` or the console), store both DSNs, and
   build the template. Both point at the `vers` database with `sslmode=verify-full` — `mcp_ro` on
   the `main` host, `mcp_dev` on the `dev` host.

   ```sh
   op item create --vault vers --category Password --title neon-mcp-ro "dsn[concealed]=<mcp_ro DSN>"
   op item create --vault vers --category Password --title neon-mcp-dev "dsn[concealed]=<mcp_dev DSN>"
   bun run pg:dev:refresh-base
   ```

## Teardown

```sh
for app in app-web bugsink umami service-activity service-avatar service-email service-keys service-replay service-session service-user service-verification; do
  fly apps destroy "vers-$app" --yes
done
```

Destroying an app releases its IPs and secrets. The Neon project and the domain outlive it.
