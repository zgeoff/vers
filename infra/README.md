# infra

The vers-infra Pulumi program declares 4 resource sets: Cloudflare DNS for `versidle.com`, the Axiom
observability backend (datasets, API tokens, monitors, notifiers, dashboards), the Neon project
layer (project, branches, compute endpoints, roles), and the zgeoff/vers GitHub repo configuration
(labels, rulesets, the production environment, Actions variables). Pulumi state is held in
Cloudflare R2. Credentials resolve from 1Password at run time, so nothing sensitive lives on disk.

- `index.ts` — apex and `www` records pointing `versidle.com` at the Fly web app, DNS-only so Fly
  serves TLS, plus the Resend records: the sending set for `transactional.versidle.com` and the
  receiving MX for `qa.versidle.com`, the domain QA test inboxes live on.
- `axiom.ts` — the Axiom resource set: the `vers-*` datasets, the ingest and query API tokens, the
  threshold monitors, the Discord alarms notifier, and the dashboards; the registries in
  `docs/architecture/platform/observability.md` describe what the monitors and instruments watch.
  Token secret values live in 1Password, out of code; stack state holds sensitive outputs encrypted.
  Any change to a token's arguments regenerates its secret, so a scope edit means updating the vault
  item and dependent Fly secrets within the 48-hour rotation grace window. The provider's own
  credential is console-managed: a token cannot rotate itself without invalidating the session doing
  the rotating.
- `neon.ts` — the Neon layer: the `vers` project, its `main` and `dev` branches with their compute
  endpoints, and the `mcp_ro` and `mcp_dev` roles. Databases, schemas, and migrations stay with the
  migration pipeline. Each role's in-database grants are SQL applied per the
  [database](../docs/architecture/platform/database.md) provisioning steps, because the Neon API
  models role existence and not privileges. Role passwords are Neon-generated secret outputs held in
  encrypted stack state. The provider's own API key is console-managed, for the same reason as the
  Axiom token.
- `github.ts` — the zgeoff/vers repo configuration: the authoritative label set (the registry the
  issue-hygiene rules point at), the `main protection` branch ruleset, the `production` environment,
  the Actions variables, and the Actions secrets. Variables are repo- and environment-scoped. The
  service-auth public key value comes from encrypted stack config, and the rest sit in code. Secret
  values resolve from the `vers-ci` vault as environment variables at run time. GitHub cannot return
  a secret's value, so the program pushes and the vault stays the source of truth. Three things stay
  console-managed and are therefore not drift: milestones and the delivery board, which are delivery
  state rather than schema; the `OP_SERVICE_ACCOUNT_TOKEN` secret, the credential the resolution
  itself authenticates with; and the provider's own PAT, for the same reason as the Axiom token.
- `sdks/axiom/`, `sdks/neon/` — committed TypeScript SDKs generated from the bridged Terraform
  providers. `pulumi package add terraform-provider axiomhq/axiom 1.6.2` and
  `pulumi package add terraform-provider kislerdm/neon 0.13.0` regenerate them, and `Pulumi.yaml`
  pins both versions.
- `Pulumi.yaml`, `Pulumi.prod.yaml` — project and `prod` stack config.
- `.env` — `op://` references resolved by `op run`; `.env.example` is the copyable full set.

## Prerequisites

- `op` authenticated (service account: `OP_SERVICE_ACCOUNT_TOKEN` in the environment).
- `versidle.com` added to Cloudflare, with the registrar's nameservers pointed at the pair
  Cloudflare assigns. DNS records attach to a zone, so this comes first.
- An R2 bucket named `vers-pulumi-state` for Pulumi state.
- An Axiom API token (the `iac-token` field on the `vers-ci` vault's `axiom` item) with org-level
  create/read/update/delete on monitors, notifiers, dashboards, datasets, and API tokens, plus query
  permission on all datasets — Axiom rejects monitor writes unless the token can query every dataset
  the monitor's APL references.
- A GitHub fine-grained PAT (the `github-token` field on the `vers-ci` vault's `vers-infra` item)
  scoped to the zgeoff/vers repository with read/write on Administration, Environments, Issues,
  Secrets, Variables, and Webhooks.
- A Neon org API key (the `api-key` field on the `vers-ci` vault's `neon` item, read as
  `NEON_API_KEY`) that manages projects, branches, endpoints, and roles in the `vers` org.

## One-time setup

Create the state bucket:

```sh
op run --env-file=.env -- sh -c 'curl -fsS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data "{\"name\":\"$R2_STATE_BUCKET\"}"'
```

Point Pulumi at the R2 backend and record the zone id (Cloudflare dashboard → versidle.com →
Overview → Zone ID):

```sh
op run --env-file=.env -- sh -c 'pulumi login \
  "s3://$R2_STATE_BUCKET?endpoint=$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true"'
op run --env-file=.env -- pulumi config set vers-infra:zoneId <zone-id> --stack prod
```

The Cloudflare token needs `Zone → DNS → Edit` (versidle.com) and
`Account → Workers R2 Storage → Edit`; the R2 S3 keys authenticate the state backend.

## Deploy

```sh
bun run preview   # op run --env-file=.env -- pulumi preview
bun run up        # op run --env-file=.env -- pulumi up
```

Once the records exist, let Fly serve TLS for the hostnames:

```sh
fly certs add versidle.com -a vers-app-web
fly certs add www.versidle.com -a vers-app-web
```
