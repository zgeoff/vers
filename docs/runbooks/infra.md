# Infra

How the vers-infra Pulumi program in `infra/` is set up and deployed, and what each of its resource
sets keeps out of code. [Provisioning](./provisioning.md) owns the order in which the platform comes
up; this page owns the program's own credentials and commands.

## Resource sets

- `index.ts` — apex and `www` records pointing `versidle.com` at the Fly web app, DNS-only so Fly
  serves TLS, plus the Resend records: the sending set for `transactional.versidle.com` and the
  receiving MX for `qa.versidle.com`, the domain QA test inboxes live on.
- `axiom.ts` — the Axiom resource set: the `vers-*` datasets, the ingest and query API tokens, the
  threshold monitors, the Discord alarms notifier, and the dashboards; the registries in
  [observability](../architecture/platform/observability.md) describe what the monitors and
  instruments watch. Token secret values live in 1Password, out of code; stack state holds sensitive
  outputs encrypted. Any change to a token's arguments regenerates its secret, so a scope edit means
  updating the vault item and dependent Fly secrets within the 48-hour rotation grace window. The
  provider's own credential is console-managed: a token cannot rotate itself without invalidating
  the session doing the rotating.
- `neon.ts` — the Neon layer: the `vers` project, its `main` and `dev` branches with their compute
  endpoints, and the `mcp_ro` and `mcp_dev` roles. Databases, schemas, and migrations stay with the
  migration pipeline. Each role's in-database grants are SQL applied per the
  [provisioning](./provisioning.md) steps, because the Neon API models role existence and not
  privileges. Role passwords are Neon-generated secret outputs held in encrypted stack state. The
  provider's own API key is console-managed, for the same reason as the Axiom token.
- `github.ts` — the zgeoff/vers repo configuration: the label set, retained until its removal and
  kept on GitHub when the resource goes, the `main protection` branch ruleset, the `production`
  environment, the Actions variables, and the Actions secrets. Variables are repo- and
  environment-scoped. The service-auth public key value comes from encrypted stack config, and the
  rest sit in code. Secret values resolve from the `vers-ci` vault as environment variables at run
  time. GitHub cannot return a secret's value, so the program pushes and the vault stays the source
  of truth. Three things stay console-managed and are therefore not drift: milestones and project
  boards, which are planning state rather than schema; the `OP_SERVICE_ACCOUNT_TOKEN` secret, the
  credential the resolution itself authenticates with; and the provider's own PAT, for the same
  reason as the Axiom token.
- `sdks/axiom/`, `sdks/neon/` — committed TypeScript SDKs generated from the bridged Terraform
  providers. `pulumi package add terraform-provider axiomhq/axiom 1.6.2` and
  `pulumi package add terraform-provider kislerdm/neon 0.13.0` regenerate them, and `Pulumi.yaml`
  pins both versions.

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

Run these from `infra/`. Create the state bucket:

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

The `infra-deploy` workflow applies each merge to `main` that changes the program. Each run first
runs a drift check, a preview of the commit before its push, and its guard holds a plan that deletes
or replaces a resource or that follows a failed drift check.
[Infra deploys](../architecture/platform/infra-deploys.md) describes the workflow, the guard and
drift.

Apply a held plan through the workflow, never with `bun run up`. The workflow's run waits in the
`infra-prod` queue, so it never overlaps another apply or preview, and its summary records the plan
and the apply.

### Answer a held apply

A held run applies nothing and ends green. Discord shows `[infra] prod apply held for a person`, and
the run's summary lists each reason under `Apply plan (prod)`.

1. From `infra/` in a clean checkout of `main`, show each change in full:

   ```sh
   bun run preview -- --refresh --diff
   ```

   Expect: a change on each resource that the reasons name.

2. When you keep a drifted resource's console change, merge a pull request that adds the change to
   the program. Expect: that merge's run holds too, because its drift check still finds the drift.
3. Dispatch the workflow on `main`:

   ```sh
   gh workflow run infra-deploy.yml --ref main
   ```

   The dispatched run applies the plan of main's tip whatever the guard finds. That plan reverts
   each console change that the program lacks. When `main` moves while the run waits, the run holds
   with `this run's commit <commit> is not main's tip <tip>`; dispatch the workflow again. Expect:
   the run's `Apply plan (prod)` holds `the job applies it because a person dispatched the run`, and
   `Drift after the apply (prod)` ends with every resource unchanged.

To drop a held change instead, merge a pull request that reverts it, then do step 3. The revert's
run holds as well. Its drift check previews the held commit, whose change never reached the stack.

### Recover a failed apply

A failed run posts `[infra] critical — prod apply failed`. Read the error under `Apply (prod)` in
the run's summary, then act on its cause:

| Cause                                        | Action                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| a provider's 5xx answer or a network timeout | dispatch the workflow, as step 3 of the held apply shows                     |
| an error in the program                      | merge a fix in a pull request, then dispatch the workflow when its run holds |
| `the stack is currently locked`              | [clear the stale lock](#clear-a-stale-lock)                                  |

A failed apply leaves the stack apart from the commit it tried to apply. The fix's drift check
previews that commit and finds the difference, so the guard holds the fix until you dispatch the
workflow.

### Clear a stale lock

An apply that hit the job's 30-minute timeout leaves Pulumi's lock on the state, and every later run
fails with `the stack is currently locked`.

1. List the runs in progress:

   ```sh
   gh run list --workflow infra-deploy.yml --status in_progress
   ```

   Expect: no runs. When the list shows a run, wait for it to end.

2. From `infra/`, clear the lock:

   ```sh
   op run --env-file=.env -- pulumi cancel --stack prod --yes
   ```

   Expect: exit 0.

3. Dispatch the workflow on `main`:

   ```sh
   gh workflow run infra-deploy.yml --ref main
   ```

## TLS for the hostnames

Once the records exist, let Fly serve TLS for the hostnames:

```sh
fly certs add versidle.com -a vers-app-web
fly certs add www.versidle.com -a vers-app-web
```
