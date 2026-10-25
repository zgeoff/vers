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

You need:

- `neonctl` authenticated through `neonctl auth` to the vers project, `patient-dust-07220142`
- `gh` authenticated to `zgeoff/vers`, with the right to merge to `main`
- a full clone of the repo with its dependencies installed through `bun install`, for the drill and
  the deploy CLI
- `flyctl` authenticated to the vers Fly organization, for `bun run deploy verify`
- the `postgres` MCP server, whose `execute_sql_prod` tool reads production
  ([agent access](../architecture/platform/database.md#agent-access-mcp))
- `psql` or Docker, for the revoke step

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

5. Follow [Prepare a restore branch](#prepare-a-restore-branch) with `<backup_branch_name>` as the
   parent and `restore-<run_id>` as the branch name.

6. Restore `main` from the head of the restore branch, and keep the pre-restore state under a new
   name:

   ```bash
   neonctl branches restore main restore-<run_id> \
     --project-id patient-dust-07220142 \
     --preserve-under-name main-before-restore-<run_id>
   ```

   Expect the command to exit with status 0. `main` keeps its ID and its connection strings. Neon
   moves the `dev` branch under `main-before-restore-<run_id>`, because `main` has `dev` as a child.

7. Check the migration history through the `execute_sql_prod` MCP tool:

   ```sql
   SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 3;
   ```

   Expect the newest row to be the migration before `<first_migration>`.

8. Send the [player notice](#tell-players-what-survived) with the backup's creation time as the
   restore point.

9. Enable the main workflow again, then merge the revert PR:

   ```bash
   gh workflow enable main.yml -R zgeoff/vers
   ```

   When the PR reverts every listed migration, expect the run's migrate step to log
   `no pending migrations; no backup taken`. Otherwise expect a new `Database backup` notice that
   names the kept migrations, and then a log line that names them as applied. Expect the deploy job
   to ship the release from the PR.

   The deploy job also registers the running sim version again, because the restore dropped every
   registry row written after the backup.

10. Delete the restore branch, and keep `main-before-restore-<run_id>` while `dev` is its child,
    because Neon deletes no branch that has children:

    ```bash
    neonctl branches delete restore-<run_id> --project-id patient-dust-07220142
    ```

    Expect the command to exit with status 0. `main-before-restore-<run_id>` holds the writes the
    restore discarded, so read any lost rows back from it.

## Restore main to a point in time

1. Stop the main workflow: follow steps 1 and 2 of [Restore main](#restore-main).

2. Pick the restore point as an RFC 3339 time in UTC, such as `2026-10-21T06:45:00Z`. It must sit
   inside the last seven days and no more than fifteen minutes before the first bad write. Find that
   write through the service logs or the error tracker.

   > **CAUTION:** The restore overwrites every database on `main` with its state at the restore
   > point: the shared `vers` database, the error tracker's database and the analytics dashboard's
   > database. Every write to them after the restore point is lost, and Neon interrupts every open
   > connection during the restore.

3. List the migrations applied after the restore point, through the `execute_sql_prod` MCP tool:

   ```sql
   SELECT name FROM kysely_migration WHERE timestamp > '<restore_point>' ORDER BY name;
   ```

   Expect no rows when no migration ran since the restore point. The restore drops each listed
   migration, and the main workflow applies it again when step 7 re-runs it. For each listed
   migration that must not come back, open a revert PR as step 4 of [Restore main](#restore-main)
   describes, and merge it in place of the re-run.

4. Follow [Prepare a restore branch](#prepare-a-restore-branch) with `<restore_point>` as the parent
   and `restore-<yyyymmdd>` as the branch name.

5. Restore `main` from the head of the restore branch, and keep the pre-restore state under a new
   name:

   ```bash
   neonctl branches restore main restore-<yyyymmdd> \
     --project-id patient-dust-07220142 \
     --preserve-under-name main-before-restore-<yyyymmdd>
   ```

   Expect the command to exit with status 0. `main` keeps its ID and its connection strings, and
   Neon moves the `dev` branch under `main-before-restore-<yyyymmdd>`.

6. Send the [player notice](#tell-players-what-survived).

7. Enable the main workflow, then re-run its latest run on `main`:

   ```bash
   gh workflow enable main.yml -R zgeoff/vers
   gh run list -R zgeoff/vers --workflow main.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId'
   gh run rerun <run_id> -R zgeoff/vers
   ```

   When step 3 listed no migration, or the revert PR drops every listed one, expect the migrate step
   to log `no pending migrations; no backup taken`. When some listed migrations stay, expect a new
   `Database backup` notice that names them, then `✅ applied <migration_names>`. In both cases
   expect the replay service's deploy leg to log
   `vers-service-replay is current at <sha> — skipping`. That leg registers the running sim version
   again, because the restore dropped every registry row written after the restore point. Until it
   does, the activity service refuses every start with `SIM_VERSION_UNKNOWN`.

8. Delete the restore branch, and keep `main-before-restore-<yyyymmdd>` while `dev` is its child:

   ```bash
   neonctl branches delete restore-<yyyymmdd> --project-id patient-dust-07220142
   ```

   Expect the command to exit with status 0. `main-before-restore-<yyyymmdd>` holds the writes the
   restore discarded.

## Prepare a restore branch

A restore branch holds the state that `main` takes on. Its sessions are revoked and its drill checks
pass before `main` moves to that state in one restore, so `main` never serves a session that the
restore brought back. These steps apply only to an incident restore or its drill, never in normal
operation.

1. Create the branch from `<parent>`, which is a restore point such as `2026-10-21T06:45:00Z` or the
   name of a backup branch, set to expire within a day:

   ```bash
   neonctl branches create --project-id patient-dust-07220142 \
     --name <restore_branch> --parent <parent> --expires-at <expiry>
   ```

   `<expiry>` is an RFC 3339 time in UTC, such as `2026-10-22T06:45:00Z`. To set it a day from now:

   ```bash
   date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ
   ```

   Expect a table row with the branch and its endpoint.

2. Read the branch's connection string as the owner role, which the revoke step needs to write:

   ```bash
   neonctl connection-string <restore_branch> --project-id patient-dust-07220142 \
     --database-name vers --role-name neondb_owner
   ```

   Expect one `postgresql://` URL that ends in `?sslmode=require&channel_binding=require`. Without
   `--role-name`, the command fails with `Multiple roles found for the branch`.

   The drill connects through postgres.js, which does not understand `channel_binding`. Derive its
   URL with `sslmode=verify-full` and without `channel_binding`, as
   [connection strings](../architecture/platform/database.md#connection-strings) requires:

   ```bash
   printf '%s' '<branch_connection_string>' \
     | sed -E 's/sslmode=[a-z-]+/sslmode=verify-full/; s/&channel_binding=[^&]*//'
   ```

   Expect the same URL ending in `?sslmode=verify-full`. It is `<drill_connection_string>`.

3. Revoke every session, every step-up grant and every pending step-up transaction on the branch:

   ```bash
   psql '<branch_connection_string>' -v ON_ERROR_STOP=1 <<'SQL'
   BEGIN;
   DELETE FROM pending_transactions;
   DO $$ BEGIN IF to_regclass('public.step_up_grants') IS NOT NULL THEN DELETE FROM step_up_grants; END IF; END $$;
   DELETE FROM sessions;
   COMMIT;
   SQL
   ```

   Without a local `psql`, run the same statements through the Postgres image, with the URL in the
   environment and the SQL on stdin:

   ```bash
   BRANCH_URL='<branch_connection_string>' docker run --rm -i -e BRANCH_URL postgres:18.6 \
     sh -c 'psql "$BRANCH_URL" -v ON_ERROR_STOP=1' <<'SQL'
   BEGIN;
   DELETE FROM pending_transactions;
   DO $$ BEGIN IF to_regclass('public.step_up_grants') IS NOT NULL THEN DELETE FROM step_up_grants; END IF; END $$;
   DELETE FROM sessions;
   COMMIT;
   SQL
   ```

   Expect `BEGIN`, `DELETE <count>`, `DO`, `DELETE <count>`, and `COMMIT`. The grant table exists
   only from its migration on, so a branch from an older backup skips its delete. The branch holds
   every session that was signed out or evicted after its parent's point, so a sign-out a player
   made would stand undone. A device whose session survived would also keep its record of the last
   activity it started, and the server lost that activity, so the verifier would never claim the
   device's later activities. With every session gone, each device runs the discard that
   [How a device reconciles](#how-a-device-reconciles) describes.

4. Find the commit the replay service runs, from an up-to-date checkout of `main`. The fleet check
   reads each app's machines through `flyctl` and diffs their commit against your checkout, so it
   needs `flyctl` authenticated and the full git history:

   ```bash
   git switch main && git pull --ff-only
   bun run deploy verify
   ```

   Expect one line per app, such as `✓ vers-service-replay — online and current at <sha>`. The
   `vers-service-replay` line holds the commit `<fleet_sha>`. A `✗` line holds a finding instead of
   the commit, so for a `✗` on `vers-service-replay` read the commit its service machines stamp. The
   filter skips the scheduled drainer and every process group other than `app`, as the deploy CLI
   does:

   ```bash
   flyctl machines list --app vers-service-replay --json \
     | jq -r '.[] | select(.config.schedule == null and (.config.metadata.fly_process_group // "app") == "app") | .config.env.GIT_SHA' \
     | sort -u
   ```

   Expect one commit, which is `<fleet_sha>`. Two commits mean a rollout stopped part way, so finish
   the replay service's deploy before you go on.

5. Check out `<fleet_sha>`, then run the drill checks against the branch:

   ```bash
   git switch --detach <fleet_sha> && bun install
   ```

   ```bash
   RESTORE_DRILL_ENGINE_HASH="$(bun run --silent deploy engine-hash)" \
     RESTORE_DRILL_DATABASE_URL='<drill_connection_string>' bun run db:restore-drill
   ```

   The engine hash identifies the engine the replay service runs in-process, which replays its own
   work whatever the registry holds. Expect the last report line to read
   `PASS: <count> of <count> checks hold`. The checks read in one read-only transaction. Each `FAIL`
   line holds a broken check, and the lines under it hold the rows that break it. Restore `main`
   from no branch that fails a check.

   A branch from before a migration lacks the tables and columns that migration adds. When the drill
   reads one of them, it stops with `❌ the restore drill could not read the restored branch` and
   the Postgres error, such as `relation "content_versions" does not exist`, and checks nothing. Run
   the drill again from a checkout of the revert PR, which reverts the code that reads the dropped
   migrations, the drill included. Keep the engine hash from the fleet's commit, and restore `main`
   only once that run passes.

## Tell players what survived

Post this notice wherever the incident is announced, with the restore point filled in:

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

The drill runs every step of a point-in-time restore up to the restore of `main`, on a disposable
branch, so it changes nothing that players use.

1. Pick a restore point inside the last seven days.

2. Follow [Prepare a restore branch](#prepare-a-restore-branch) with `<restore_point>` as the parent
   and `restore-drill-<yyyymmdd>` as the branch name.

3. Record the drill report and the time from the branch create to the end of the drill checks. That
   span covers the branch restore and the checks, and you compare it against the recovery-time
   target.

4. Delete the branch:

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
