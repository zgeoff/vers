# infra

Cloudflare DNS for `versidle.com` and Axiom alerting (monitors, notifiers), with Pulumi state held
in Cloudflare R2. Credentials resolve from 1Password at run time, so nothing sensitive lives on
disk.

- `index.ts` — apex and `www` records pointing `versidle.com` at the Fly web app, DNS-only so Fly
  serves TLS.
- `axiom.ts` — the Axiom threshold monitors and the Discord alarms notifier; the monitor registry in
  `docs/architecture/observability.md` describes what each one watches.
- `sdks/axiom/` — committed TypeScript SDK generated from the bridged Terraform provider
  (`pulumi package add terraform-provider axiomhq/axiom 1.6.2` regenerates it; the version is pinned
  in `Pulumi.yaml`).
- `Pulumi.yaml`, `Pulumi.prod.yaml` — project and `prod` stack config.
- `.env` — `op://` references resolved by `op run`; `.env.example` is the copyable full set.

## Prerequisites

- `op` authenticated (service account: `OP_SERVICE_ACCOUNT_TOKEN` in the environment).
- `versidle.com` added to Cloudflare, with the registrar's nameservers pointed at the pair
  Cloudflare assigns. DNS records attach to a zone, so this comes first.
- An R2 bucket named `vers-pulumi-state` for Pulumi state.
- An Axiom API token (the `iac-token` field on the vault's `axiom` item) with org-level
  monitors/notifiers/dashboards create/read/update/delete and query permission on the `vers-*`
  datasets — Axiom rejects monitor writes unless the token can query every dataset the monitor's APL
  references.

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
