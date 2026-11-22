# QA cold path

To test a cold start by hand, as part of the [QA runbook](qa.md#cold-path), ready the fleet with
`bun run qa:cold`. It suspends every service machine of every app in `deploy.config.ts`, or stops a
machine where the app's `fly.toml` parks idle machines with `stop`, then prints each app's machine
states.

Before it touches a machine, the script reads the last 10 minutes of the `vers-traces` dataset in
Axiom. It refuses and exits 1, with the request count and the busiest routes, when any request
reached the fleet other than these two:

- a `/health` check;
- the signed-out `getAvatars` call that `bun run deploy verify` sends, answered with 401.

This check keeps the script from suspending a fleet that serves a player. `deploy.config.ts` lists
only production apps, so the check applies to every app, and the script never skips it: `--force` is
refused before the check runs, with exit 2. After a refusal, run the script again once the window
holds no player traffic.

1. Check the verdict and the planned actions, without acting:

   ```bash
   bun run qa:cold --dry-run
   ```

2. Send the fleet cold, and wait until every machine reports suspended or stopped:

   ```bash
   bun run qa:cold --wait
   ```

   `--wait` polls for at most 3 minutes. The deadline also ends a `flyctl` read that is still
   pending, so a stalled read cannot hold the wait open past it. Without `--wait`, the script prints
   the machine states as soon as it has sent the suspends and stops.

3. Run the QA pass. Its first request wakes each machine it reaches.

The script reads `AXIOM_TOKEN` and `FLY_API_TOKEN` from the environment, and when either is unset it
reads the `vers-ci` 1Password vault through the `op` CLI: the `axiom` item's `iac-token` field and
the `github-actions` item's `fly-api-token` field.
