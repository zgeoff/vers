# infra

The vers-infra Pulumi program declares 4 resource sets: Cloudflare DNS for `versidle.com`, the Axiom
observability backend (datasets, API tokens, monitors, notifiers, dashboards), the Neon project
layer (project, branches, compute endpoints, roles), and the zgeoff/vers GitHub repo configuration
(labels, rulesets, the production environment, Actions variables). Pulumi state is held in
Cloudflare R2. Credentials resolve from 1Password at run time, so nothing sensitive lives on disk.

- `index.ts` — the Cloudflare DNS records for `versidle.com`.
- `axiom.ts` — the Axiom resource set.
- `neon.ts` — the Neon layer.
- `github.ts` — the zgeoff/vers repo configuration.
- `sdks/axiom/`, `sdks/neon/` — committed TypeScript SDKs generated from the bridged Terraform
  providers.
- `Pulumi.yaml`, `Pulumi.prod.yaml` — project and `prod` stack config.
- `.env` — `op://` references resolved by `op run`; `.env.example` is the copyable full set.

The [infra runbook](../docs/runbooks/infra.md) holds what each resource set keeps out of code, the
prerequisites, the one-time setup, and the deploy commands:

```sh
bun run preview   # op run --env-file=.env -- pulumi preview
bun run up        # op run --env-file=.env -- pulumi up
```
