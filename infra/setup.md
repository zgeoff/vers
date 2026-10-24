# vers-infra setup

The vers-infra Pulumi program needs the accounts and credentials below, and a one-time state backend
in Cloudflare R2. The [README](./README.md) covers what the program declares and how to deploy it.

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
