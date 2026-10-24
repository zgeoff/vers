# Checkpoint archive

The checkpoint retention workflow runs the archive sweep once a day against the production database.
The sweep archives the checkpoint rows of each activity verified more than 24 hours ago to an R2
bucket, and purges an archive 90 days after the sweep wrote it.
[Database](../architecture/platform/database.md#checkpoint-retention) owns the tiers and the rules
that move rows between them. This runbook turns the sweep on and restores one activity's rows.

## Enable the sweep

The workflow stops before any read while one of the four `CHECKPOINT_ARCHIVE_*` secrets is unset,
and logs a warning with each missing key. With every secret set, the sweep logs what it would
archive and purge, and writes and deletes nothing, until the `CHECKPOINT_ARCHIVE_APPLY` repository
variable is `true`.

1. Create the R2 bucket and an R2 API token scoped to read and write that bucket only.
2. Set the four secrets in the `production` environment of zgeoff/vers:

   ```bash
   gh secret set CHECKPOINT_ARCHIVE_ENDPOINT --env production -R zgeoff/vers
   gh secret set CHECKPOINT_ARCHIVE_BUCKET --env production -R zgeoff/vers
   gh secret set CHECKPOINT_ARCHIVE_ACCESS_KEY_ID --env production -R zgeoff/vers
   gh secret set CHECKPOINT_ARCHIVE_SECRET_ACCESS_KEY --env production -R zgeoff/vers
   ```

   The endpoint is `https://<cloudflare_account_id>.r2.cloudflarestorage.com`.

3. Run the workflow once in report mode:

   ```bash
   gh workflow run checkpoint-retention.yml -R zgeoff/vers
   ```

   Expect the `Sweep` step to log a line that starts with `checkpoint sweep (report only):`.

4. Turn on the writes and deletes:

   ```bash
   gh variable set CHECKPOINT_ARCHIVE_APPLY --body true -R zgeoff/vers
   ```

   The next run logs a line that starts with `checkpoint sweep: archived`.

## Restore one activity

The restore reinserts every archived row of one activity into the checkpoint table and clears the
head row's archive stamp. The next daily sweep archives the activity again, so finish the
investigation before that run, or run the restore again.

1. Export the production `DATABASE_URL` and the four `CHECKPOINT_ARCHIVE_*` values into your shell.
2. Run the restore with the activity id:

   ```bash
   bun run checkpoints:archive restore --activity <activity_id>
   ```

   Expect `restored <row_count> row(s) of activity <activity_id>`. The output
   `✗ no archive at checkpoints/<avatar_id>/<activity_id>.jsonl.gz` means the sweep never archived
   the activity or has purged its archive. The output that starts with
   `✗ checkpoint archive — another sweep or restore holds the archive lock` means a sweep is
   running: wait for its workflow run to end, then run the restore again.
