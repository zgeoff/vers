# infra

The vers-infra Pulumi program declares Cloudflare DNS for `versidle.com`, the Axiom observability
backend (datasets, API tokens, monitors, notifiers, dashboards), the Neon project layer (project,
branches, compute endpoints, roles), and the zgeoff/vers GitHub repo configuration (labels,
rulesets, the production environment, Actions variables). Pulumi state is held in Cloudflare R2.
Credentials resolve from 1Password at run time, so nothing sensitive lives on disk. Read this file
before you change or deploy the program.

- `index.ts` — the Cloudflare DNS records for `versidle.com`.
- `axiom.ts` — the Axiom resource set.
- `neon.ts` — the Neon layer.
- `github.ts` — the zgeoff/vers repo configuration.
- `sdks/axiom/`, `sdks/neon/` — committed TypeScript SDKs generated from the bridged Terraform
  providers.
- `Pulumi.yaml`, `Pulumi.prod.yaml` — project and `prod` stack config.
- `.env` — `op://` references resolved by `op run`; `.env.example` is the copyable full set.

Read the [infra runbook](../docs/runbooks/infra.md) for what stays outside code in each resource
set, the prerequisites, the one-time setup, and the commands you run by hand:

```sh
bun run preview   # op run --env-file=.env -- pulumi preview
bun run up        # op run --env-file=.env -- pulumi up
```

When a merge to `main` changes this program, the `infra-deploy` workflow applies it, unless a guard
holds the plan for a person. Run `bun run up` yourself only for the steps in
[provisioning](../docs/runbooks/provisioning.md). Apply a held plan by dispatching `infra-deploy`,
following the infra runbook. On a pull request, the `infra-drift` workflow's `preview` job checks
`main` for drift, previews the pull request's change, and shows both in its summary. For both
workflows, see [Infra deploys](../docs/architecture/platform/infra-deploys.md).
