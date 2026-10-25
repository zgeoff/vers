import { createDB } from '@vers/db';
import { S3Client } from 'bun';
import { Command } from 'commander';
import { match } from 'ts-pattern';
import { CHECKPOINT_RETENTION } from '../checkpoint-archive/checkpoint-retention';
import { parseArchiveConfig } from '../checkpoint-archive/parse-archive-config';
import { restoreActivityCheckpoints } from '../checkpoint-archive/restore-activity-checkpoints';
import { runCheckpointSweep } from '../checkpoint-archive/run-checkpoint-sweep';
import type { CheckpointArchiveDeps } from '../checkpoint-archive/types';
import { withArchiveLock } from '../checkpoint-archive/with-archive-lock';
import { requireEnvVar } from '../utils/require-env-var';

const BUSY_MESSAGE =
  '✗ checkpoint archive — another sweep or restore holds the archive lock; nothing read, written or deleted';

interface SweepCommandOptions {
  readonly apply: boolean;
}

interface RestoreCommandOptions {
  readonly activity: string;
}

const program = new Command()
  .name('checkpoint-archive')
  .description(
    'Archive verified checkpoint rows to object storage, purge old archives, restore one',
  );

program
  .command('sweep')
  .description(
    'report the activities past the hot window and the archives past retention; --apply archives and purges them',
  )
  .option('--apply', 'archive the rows and purge the expired archives', false)
  .action(async (options: SweepCommandOptions) => {
    const deps = createArchiveDeps();

    if (deps === undefined) {
      return;
    }

    const swept = await withArchiveLock(deps.db, (connection) =>
      runCheckpointSweep(
        { bucket: deps.bucket, db: connection },
        { apply: options.apply, limit: CHECKPOINT_RETENTION.sweepLimit, now: new Date() },
      ),
    );

    await deps.db.destroy();

    if (swept.kind === 'busy') {
      console.error(BUSY_MESSAGE);

      process.exitCode = 1;

      return;
    }

    const summary = swept.result;

    const report = options.apply
      ? `checkpoint sweep: archived ${summary.archived} of ${summary.candidates} activity(ies), deleted ${summary.deletedRows} row(s), skipped ${summary.changed} that changed, purged ${summary.purged} archive(s)`
      : `checkpoint sweep (report only): ${summary.candidates} activity(ies) would archive, ${summary.expiredArchives} archive(s) would purge; pass --apply to write and delete`;

    console.log(report);
  });

program
  .command('restore')
  .description("reinsert one archived activity's checkpoint rows from its archive")
  .requiredOption('--activity <id>', 'the activity id')
  .action(async (options: RestoreCommandOptions) => {
    const deps = createArchiveDeps();

    if (deps === undefined) {
      process.exitCode = 1;

      return;
    }

    const restore = await withArchiveLock(deps.db, (connection) =>
      restoreActivityCheckpoints({ bucket: deps.bucket, db: connection }, options.activity),
    );

    await deps.db.destroy();

    if (restore.kind === 'busy') {
      console.error(BUSY_MESSAGE);

      process.exitCode = 1;

      return;
    }

    match(restore.result)
      .with({ kind: 'restored' }, (restored) => {
        console.log(`restored ${restored.restoredRows} row(s) of activity ${options.activity}`);
      })
      .with({ kind: 'missing-activity' }, () => {
        console.error(`✗ no activity ${options.activity}`);

        process.exitCode = 1;
      })
      .with({ kind: 'missing-archive' }, (missing) => {
        console.error(
          `✗ no archive at ${missing.key}: activity ${options.activity} was never archived or its archive was purged`,
        );

        process.exitCode = 1;
      })
      .exhaustive();
  });

await program.parseAsync();

function createArchiveDeps(): CheckpointArchiveDeps | undefined {
  const archive = parseArchiveConfig(process.env);

  if (archive.kind === 'missing') {
    console.log(
      `::warning::checkpoint archive stopped before any read, write or delete: ${archive.missingKeys.join(', ')} not set`,
    );

    return undefined;
  }

  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the checkpoint archive reads and deletes checkpoint rows in the shared database',
  );

  return {
    bucket: new S3Client({
      accessKeyId: archive.config.accessKeyID,
      bucket: archive.config.bucket,
      endpoint: archive.config.endpoint,
      secretAccessKey: archive.config.secretAccessKey,
    }),
    db: createDB({ databaseURL }),
  };
}
