# Deployment

Where the stack runs, how a merge reaches production, and how to re-provision it from nothing.

## Topology

The stack runs on Fly.io in the `syd` region. `app-web` holds the only public address. The domain
services — `service-avatar`, `service-session`, `service-user`, `service-verification` — are
private, reachable only across the organization's 6PN WireGuard mesh. Postgres is a Neon project
(see [database](./database.md)); no app runs its own database.

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

| App                                                      | Secrets                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `service-avatar`, `service-user`, `service-verification` | `DATABASE_URL`, `SERVICE_AUTH_PUBLIC_KEY`                     |
| `service-session`                                        | the above + `API_IDENTIFIER`, `JWT_SIGNING_PRIVKEY`           |
| `app-web`                                                | `SESSION_SECRET`, `COOKIE_DOMAIN`, `SERVICE_AUTH_PRIVATE_KEY` |

`SERVICE_AUTH_PUBLIC_KEY` is the Ed25519 SPKI public key a service verifies inbound calls with;
`SERVICE_AUTH_PRIVATE_KEY` is its PKCS8 private half, which `app-web` signs outbound s2s tokens with
— every token's `aud` is the target's registered service name (`service-user`).
`JWT_SIGNING_PRIVKEY` is the RS256 PKCS8 private key `service-session` signs user tokens with, under
issuer and audience `API_IDENTIFIER`. `SESSION_SECRET` seals `app-web`'s cookies. `SENTRY_DSN` and
`OTEL_EXPORTER_OTLP_ENDPOINT` are optional on any app.

## Release

A push to `main` runs `.github/workflows/main.yml`. Once the checks pass, the pipeline migrates and
rolls out:

1. Neon migrations apply once — several services share the one database, so migration never runs per
   service.
2. Each affected app's image builds and pushes to `registry.fly.io/<app>:<sha>`.
3. `flyctl deploy --image` ships each affected app, retried up to three times against transient
   `syd` host-capacity refusals. `app-web` uses the `bluegreen` strategy — a full parallel fleet
   passes `/health` before traffic cuts over atomically — because it is the one public app. Services
   use `rolling` with `max_unavailable = 1`, updating a machine in place while the other keeps
   serving; a broken boot fails the health gate and halts the rollout with the old machine still up.
4. `app-web`'s public `/health` is polled as an end-to-end check. A service, being private, is
   verified by its rollout health gate alone.

Only a fully green run deploys, and only affected apps.

## Provision from nothing

Requires `flyctl` authenticated to the `vers` org, the Neon pooled `DATABASE_URL`, and the domain in
`$DOMAIN`.

Create the apps:

```sh
for app in app-web service-avatar service-session service-user service-verification; do
  fly apps create "vers-$app" --org vers
done
```

Give `app-web` public addresses; give each service a private Flycast address and no public IP:

```sh
fly ips allocate-v4 --shared -a vers-app-web
fly ips allocate-v6 -a vers-app-web
for svc in avatar session user verification; do
  fly ips allocate-v6 --private -a "vers-service-$svc"
done
```

Mint the CI deploy token and store it for the workflow:

```sh
fly tokens create deploy --name github-ci | gh secret set FLY_API_TOKEN
```

Generate the keys and set each app's secrets:

```sh
openssl genpkey -algorithm ed25519 -out s2s.key
openssl pkey -in s2s.key -pubout -out s2s.pub
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out session.key

for svc in avatar user verification; do
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

The next push to `main` fills the machines.

## Teardown

```sh
for app in app-web service-avatar service-session service-user service-verification; do
  fly apps destroy "vers-$app" --yes
done
```

Destroying an app releases its IPs and secrets. The Neon project and the domain outlive it.
