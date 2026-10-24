# Database restore

Before the migrate job in the main workflow applies a migration, it creates a Neon branch off `main`
that holds every database on `main` as it stood just before. This runbook restores `main` from that
backup branch, for a migration that succeeded and damaged data or the schema. The backup branch has
no compute and expires 14 days after the run that created it. A run that finds no pending migration
creates no backup branch. [Deployment](../architecture/platform/deployment.md#pipeline) owns the
migrate job, and [database](../architecture/platform/database.md) owns the Neon topology.

You need `neonctl` authenticated through `neonctl auth` to the vers project,
`patient-dust-07220142`, and the right to merge to `main`.

## When to restore

A run whose migration fails needs no restore. Kysely applies the pending migrations of a run in one
Postgres transaction, so a failure rolls back every migration of that run, including the ones that
ran before the failing one. The step's error line names the failed migration and says that the run
rolled back. Fix the migration and push again, and the next run takes a fresh backup.

Restore only when a migration that succeeded damaged data or the schema, and a new migration cannot
repair it. A restore discards every write after the backup, so a migration that fixes forward loses
less.

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

The migrate job applies every migration on `main` that the database lacks. Revert the migration in
the repo before the restore lands, so the next run does not apply it again.

1. Open a PR that reverts the migration and the code that depends on it. Leave it unmerged.
2. Disable the main workflow, so that no push starts a run that migrates or deploys during the
   restore:

   ```bash
   gh workflow disable main.yml -R zgeoff/vers
   ```

   Expect `gh workflow list --all -R zgeoff/vers` to show the `Main` workflow as
   `disabled_manually`.

3. Wait until every run of the main workflow that already started has finished:

   ```bash
   gh run list -R zgeoff/vers --workflow main.yml --limit 20 --json databaseId,status \
     --jq '.[] | select(.status != "completed")'
   ```

   Repeat the command until it prints nothing. A run that is still queued or in progress can apply
   the migration again after the restore.

   > **CAUTION:** The restore overwrites every database on `main` with its state at the backup: the
   > shared `vers` database, the error tracker's database and the analytics dashboard's database.
   > Every write to them after the backup is lost. Neon interrupts every open connection during the
   > restore. The fleet keeps running the release that needs the migration, so the features that use
   > it fail until the revert deploys.

4. Restore `main` from the head of the backup branch, and keep the pre-restore state under a new
   name:

   ```bash
   neonctl branches restore main <backup_branch_name> \
     --project-id patient-dust-07220142 \
     --preserve-under-name main-before-restore-<run_id>
   ```

   Expect the command to exit with status 0. `main` keeps its ID and its connection strings. Neon
   moves the `dev` branch under `main-before-restore-<run_id>`, because `main` has `dev` as a child.

5. Check the migration history through the `execute_sql_prod` MCP tool:

   ```sql
   SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 3;
   ```

   Expect the newest row to be the migration before the reverted one.

6. Enable the main workflow again, then merge the revert PR:

   ```bash
   gh workflow enable main.yml -R zgeoff/vers
   ```

   Expect the run's migrate step to log `no pending migrations; no backup taken` and the deploy job
   to ship the reverted release.

7. Keep `main-before-restore-<run_id>` while `dev` is its child, because Neon deletes no branch that
   has children. It holds the writes the restore discarded, so read any lost rows back from it.

## Remove old backup branches

Each backup branch is named `pre-migrate-<short_sha>-run-<run_id>-<attempt>`, which sets it apart
from `main` and `dev`. Neon deletes a backup branch when its expiry passes, so old backups need no
sweep. To remove one before then, such as after a restore from it, delete it by name:

```bash
neonctl branches list --project-id patient-dust-07220142
neonctl branches delete <backup_branch_name> --project-id patient-dust-07220142
```

Expect the list to show each `pre-migrate-` branch, and the delete to exit with status 0.
