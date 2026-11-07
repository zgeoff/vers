# QA cold path

`bun run qa:cold` readies a manual QA pass of a cold start. It suspends every service machine of
every app in `deploy.config.ts`, or stops a machine where the app's `fly.toml` parks idle machines
with `stop`, then prints each app's machine states.

Before it touches a machine, the script reads the last 10 minutes of the `vers-traces` dataset in
Axiom. It refuses, with the request count and the busiest routes, when any request reached the fleet
other than these two:

- a `/health` check;
- the signed-out `getAvatars` call that `bun run deploy verify` sends, answered with 401.

This check keeps the script from suspending a fleet that serves a player. `deploy.config.ts` lists
only production apps, so the check applies to every app, and the script never skips it. Given
`--force`, the script prints the refusal and exits 2.

```bash
bun run qa:cold --dry-run
bun run qa:cold --wait
```

`--dry-run` prints the verdict and the planned actions without acting. `--wait` polls until every
machine reports suspended or stopped, for at most 3 minutes; the deadline also ends a `flyctl` read
that is still pending, so a stalled read cannot hold the wait open past it. The script reads
`AXIOM_TOKEN` and `FLY_API_TOKEN` from the environment, and when either is unset it reads the
`vers-ci` 1Password vault through the `op` CLI: the `axiom` item's `iac-token` field and the
`github-actions` item's `fly-api-token` field.
