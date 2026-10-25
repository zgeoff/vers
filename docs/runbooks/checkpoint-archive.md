# Checkpoint archive

The checkpoint retention workflow runs the archive sweep once a day against the production database.
The sweep archives the checkpoint rows of each activity verified more than 24 hours ago to the
`vers-checkpoint-archive` R2 bucket, and purges an archive 90 days after the sweep wrote it. The
same purge removes a 90-day-old archive whose activity row is gone, such as one of a deleted avatar.
[Database](../architecture/platform/database.md#checkpoint-retention) owns the tiers and the rules
that move rows between them. This runbook turns the sweep on and restores one activity's rows.

## Enable the sweep

The workflow stops before any read while one of the four `CHECKPOINT_ARCHIVE_*` secrets is unset,
and logs a warning with each missing key. Report-only is the default: with every secret set, the
sweep logs what it would archive and purge, and writes and deletes nothing, until the
`CHECKPOINT_ARCHIVE_APPLY` repository variable is `true`. The repository owner reads a report-only
run and approves the first writing run. Nobody sets the variable before that approval.

The archive has its own bucket and token, and never reuses the Bugsink R2 key. The bucket is
`vers-checkpoint-archive`. Its R2 API token is scoped to that bucket only, with object read and
write, and the `r2-checkpoint-archive` item in the `vers` 1Password vault holds it. The four
`CHECKPOINT_ARCHIVE_*` secrets in the `production` environment of zgeoff/vers carry the endpoint
(`https://<cloudflare_account_id>.r2.cloudflarestorage.com`), the bucket name and the token's key
pair.

1. Run the workflow once in report mode:

   ```bash
   gh workflow run checkpoint-retention.yml -R zgeoff/vers
   ```

   Expect the `Sweep` step to log a line that starts with `checkpoint sweep (report only):`.

2. Send the report line to the repository owner, and wait for their approval.
3. After the approval, turn on the writes and deletes:

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
