# Database restore

This runbook moves `main` back in time after an incident, brings players back onto the restored
state, and rehearses the restore on a disposable branch. Two sources hold the past:

- A backup branch. Before the migrate job in the main workflow applies a migration, it creates a
  Neon branch off `main` that holds every database on `main` as it stood just before. The backup
  branch has no compute and expires 14 days after the run that created it. A run that finds no
  pending migration creates no backup branch.
- The project's point-in-time history, which reaches back seven days. `main` restores to any instant
  inside it.

[Deployment](../architecture/platform/deployment.md#pipeline) owns the migrate job, and
[database](../architecture/platform/database.md#recovery-window) owns the Neon topology, the
recovery window, and the data-loss and recovery-time targets.

You need `neonctl` authenticated through `neonctl auth` to the vers project,
`patient-dust-07220142`, `psql`, and the right to merge to `main`.

## When to restore

A failed run usually needs no restore. Kysely applies the pending migrations of a run in one
Postgres transaction, so a failure rolls back every migration of that run, including the ones that
ran before the failing one. After a failure, the step reads the pending migrations again and logs
the outcome it finds:

- `none persisted and no restore is needed`: fix the migration and push again. The next run takes a
  fresh backup.
- `<migration_names> persisted`: those migrations stayed applied. Judge them by the rule below.

Restore only when a migration that stayed applied damaged data or the schema, and a new migration
cannot repair it. A restore discards every write after the backup, so a migration that fixes forward
loses less.

Restore to a point in time when a running release, an operator, or an attacker damaged data, and no
forward fix can rebuild it. Pick the restore point no more than fifteen minutes before the first bad
write, because each minute earlier discards more player progress.

## Find the backup branch

1. Open the main workflow run whose `Migrate database` job applied the migration.
2. Open the job's `Back Up And Migrate The Database` step. Expect a `Database backup` notice:

   ```text
   Neon branch pre-migrate-<short_sha>-run-<run_id>-<attempt> (<branch_id>) holds the database before <migration_names>: <console_url>
   ```

   The notice also shows on the run's summary page. A step that logs
   `no pending migrations; no backup taken` applied no migration, so the backup you need is in an
   earlier run.

3. Check that the branch still exists:

   ```bash
   neonctl branches get <backup_branch_name> --project-id patient-dust-07220142
   ```

   Expect a table row with the branch name. `branch not found` means the branch has expired.

## Restore main

The restore drops every migration applied after the backup: the ones in the run that took it, and
the ones that later runs applied. The migrate job applies each migration file the database lacks, so
the repo has to drop the migrations that must not come back before the next run.

1. Disable the main workflow, so that no push starts a run that migrates or deploys during the
   restore:

   ```bash
   gh workflow disable main.yml -R zgeoff/vers
   ```

   Expect `gh workflow list --all -R zgeoff/vers` to show the `Main` workflow as
   `disabled_manually`.

2. Wait until every run of the main workflow that already started has finished:

   ```bash
   for status in requested queued pending waiting action_required in_progress; do
     gh run list -R zgeoff/vers --workflow main.yml --status "$status" --limit 1000 \
       --json databaseId,status --jq '.[]'
   done
   ```

   Repeat the loop until it prints nothing. Each query filters by status, so a run that started long
   ago still shows. A run that is still queued or in progress can apply a dropped migration again
   after the restore.

3. List the migrations that the restore drops, through the `execute_sql_prod` MCP tool. Use the
   first migration that the backup notice names as `<first_migration>`:

   ```sql
   SELECT name FROM kysely_migration WHERE name >= '<first_migration>' ORDER BY name;
   ```

   Expect the first row to be `<first_migration>`. No run is left to apply a migration, so the list
   stays complete until the restore.

4. Open a PR that reverts each listed migration that must not come back, and the code that depends
   on it. Leave it unmerged. Each listed migration that the PR keeps applies again on the next run,
   after a fresh backup.

   > **CAUTION:** The restore overwrites every database on `main` with its state at the backup: the
   > shared `vers` database, the error tracker's database and the analytics dashboard's database.
   > Every write to them after the backup is lost. Neon interrupts every open connection during the
   > restore. The fleet keeps running the release that needs the migration, so the features that use
   > it fail until the revert deploys.

5. Restore `main` from the head of the backup branch, and keep the pre-restore state under a new
   name:

   ```bash
   neonctl branches restore main <backup_branch_name> \
     --project-id patient-dust-07220142 \
     --preserve-under-name main-before-restore-<run_id>
   ```

   Expect the command to exit with status 0. `main` keeps its ID and its connection strings. Neon
   moves the `dev` branch under `main-before-restore-<run_id>`, because `main` has `dev` as a child.

6. Check the migration history through the `execute_sql_prod` MCP tool:

   ```sql
   SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 3;
   ```

   Expect the newest row to be the migration before `<first_migration>`.

7. Follow [Bring players back](#bring-players-back) with the backup's creation time as the restore
   point.

8. Enable the main workflow again, then merge the revert PR:

   ```bash
   gh workflow enable main.yml -R zgeoff/vers
   ```

   When the PR reverts every listed migration, expect the run's migrate step to log
   `no pending migrations; no backup taken`. Otherwise expect a new `Database backup` notice that
   names the kept migrations, and then a log line that names them as applied. Expect the deploy job
   to ship the release from the PR.

   The deploy job also registers the running sim version again, because the restore dropped every
   registry row written after the backup.

9. Keep `main-before-restore-<run_id>` while `dev` is its child, because Neon deletes no branch that
   has children. It holds the writes the restore discarded, so read any lost rows back from it.

## Restore main to a point in time

1. Stop the main workflow: follow steps 1 and 2 of [Restore main](#restore-main).

2. Pick the restore point as an RFC 3339 time in UTC, such as `2026-10-21T06:45:00Z`. It must sit
   inside the last seven days and no more than fifteen minutes before the first bad write. Find that
   write through the service logs or the error tracker.

   > **CAUTION:** The restore overwrites every database on `main` with its state at the restore
   > point: the shared `vers` database, the error tracker's database and the analytics dashboard's
   > database. Every write to them after the restore point is lost, and Neon interrupts every open
   > connection during the restore.

3. Restore `main` to the restore point, and keep the pre-restore state under a new name:

   ```bash
   neonctl branches restore main ^self@<restore_point> \
     --project-id patient-dust-07220142 \
     --preserve-under-name main-before-restore-<yyyymmdd>
   ```

   Expect the command to exit with status 0. `main` keeps its ID and its connection strings, and
   Neon moves the `dev` branch under `main-before-restore-<yyyymmdd>`.

4. Follow [Bring players back](#bring-players-back).

5. Enable the main workflow, then re-run its latest run on `main`:

   ```bash
   gh workflow enable main.yml -R zgeoff/vers
   gh run list -R zgeoff/vers --workflow main.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId'
   gh run rerun <run_id> -R zgeoff/vers
   ```

   Expect the migrate step to log `no pending migrations; no backup taken`, and the replay service's
   deploy leg to log `vers-service-replay is current at <sha> — skipping`. That leg registers the
   running sim version again, because the restore dropped every registry row written after the
   restore point. Until it does, the activity service refuses every start with
   `SIM_VERSION_UNKNOWN`.

6. Keep `main-before-restore-<yyyymmdd>` while `dev` is its child. It holds the writes the restore
   discarded.

## Bring players back

Run these steps against `main` straight after the restore, before players reach the restored state.
They apply only after an incident restore, never in normal operation.

1. Read the owner connection string of `main`:

   ```bash
   neonctl connection-string main --project-id patient-dust-07220142 --database-name vers
   ```

   Expect one `postgresql://` URL.

2. Revoke every session, every step-up grant and every pending step-up transaction:

   ```bash
   psql '<owner_connection_string>' -v ON_ERROR_STOP=1 -c 'BEGIN; DELETE FROM step_up_grants; DELETE FROM pending_transactions; DELETE FROM sessions; COMMIT;'
   ```

   Expect `BEGIN`, three `DELETE <count>` lines, and `COMMIT`. The restore brought back every
   session that was signed out or evicted after the restore point, so a sign-out a player made would
   stand undone. A device whose session survived would also keep its record of the last activity it
   started, and the server lost that activity, so the verifier would never claim the device's later
   activities. With every session gone, each device runs the discard that
   [How a device reconciles](#how-a-device-reconciles) describes.

3. Check the restored state with the drill checks:

   ```bash
   RESTORE_DRILL_DATABASE_URL='<owner_connection_string>' bun run db:restore-drill
   ```

   Expect the last report line to read `PASS: <count> of <count> checks hold`. The checks read in
   one read-only transaction. Each `FAIL` line holds a broken check, and the lines under it hold the
   rows that break it.

4. Tell players what survived, in the incident notice:

   ```text
   We restored the game to <restore_point> UTC. Progress made after that time is gone: XP, items,
   cleared and revealed nodes, and accounts created since. Sign in again to carry on from there.
   ```

## How a device reconciles

A device holds, per browser profile, its outbox of undelivered activity starts and checkpoints, a
record per avatar of the last activity it started, and a cached seed for each revealed node. The
cached seed holds the node's genesis seed and the chain anchor that local play has reached. After
the restore, every one of them can describe history the server no longer has.

1. The device's next server call finds no session. The web app answers that the session was
   superseded, and the worker discards the outbox, the last-started records and the cached node
   seeds. The player lands on the sign-in page.
2. After sign-in, the game route reveals the avatar's nodes again, and the device caches the
   server's genesis seeds and anchors. A node first revealed after the restore point has no chain on
   the server, so its reveal mints a fresh genesis seed and the node's history starts over.
3. The worker's first resync reads the server's confirmed position, rebuilds the optimistic state
   from the verified head, and fast-forwards the idle gap from there.

The player sees the XP, items, and cleared and revealed nodes of the restore point, and nothing from
after it. No history combines with the restored one: the server admits a start only at its chain's
exact appended anchor, so a start built on lost play is refused. An item's identity is its chain
position, so a position the restored chain draws again mints at most one item.

## Rehearse a point-in-time restore

The drill restores a disposable branch rather than `main`, so it changes nothing that players use.

1. Pick a restore point inside the last seven days, and note the time you start.

2. Create a branch of `main` at the restore point, set to expire within a day:

   ```bash
   neonctl branches create --project-id patient-dust-07220142 \
     --name restore-drill-<yyyymmdd> --parent <restore_point> --expires-at <expiry>
   ```

   Expect a table row with the branch and its endpoint.

3. Read the branch's connection string:

   ```bash
   neonctl connection-string restore-drill-<yyyymmdd> --project-id patient-dust-07220142 --database-name vers
   ```

   Expect one `postgresql://` URL.

4. Run the drill checks against the branch:

   ```bash
   RESTORE_DRILL_DATABASE_URL='<branch_connection_string>' bun run db:restore-drill
   ```

   Expect the last report line to read `PASS: <count> of <count> checks hold`. Record the report and
   the time from step 1 to here, which measures the restore and the checks against the recovery-time
   target.

5. Delete the branch:

   ```bash
   neonctl branches delete restore-drill-<yyyymmdd> --project-id patient-dust-07220142
   ```

   Expect the command to exit with status 0.

## Remove old backup branches

Each backup branch is named `pre-migrate-<short_sha>-run-<run_id>-<attempt>`, which sets it apart
from `main` and `dev`. Neon deletes a backup branch when its expiry passes, so old backups need no
sweep. To remove one before then, such as after a restore from it, delete it by name:

```bash
neonctl branches list --project-id patient-dust-07220142
neonctl branches delete <backup_branch_name> --project-id patient-dust-07220142
```

Expect the list to show each `pre-migrate-` branch, and the delete to exit with status 0.
