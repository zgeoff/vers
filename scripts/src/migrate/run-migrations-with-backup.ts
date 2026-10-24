import { applyMigrations, readPendingMigrations } from '@vers/db';
import { createNeonBackupBranch } from './create-neon-backup-branch';
import type { MigrationRun, NeonBranch } from './types';

interface RunMigrationsWithBackupConfig {
  readonly databaseURL: string;
  readonly backup: Parameters<typeof createNeonBackupBranch>[0];
  readonly onBackupCreated: (
    branch: NeonBranch,
    pendingMigrationNames: ReadonlyArray<string>,
  ) => void;
}

export async function runMigrationsWithBackup(
  config: RunMigrationsWithBackupConfig,
): Promise<MigrationRun> {
  const pendingMigrationNames = await readPendingMigrations({ databaseURL: config.databaseURL });

  if (pendingMigrationNames.length === 0) {
    return checkMigrationHistory(config.databaseURL);
  }

  const backupBranch = await createNeonBackupBranch(config.backup);

  config.onBackupCreated(backupBranch, pendingMigrationNames);

  const resultSet = await applyMigrations({ databaseURL: config.databaseURL });

  const appliedMigrationNames = (resultSet.results ?? [])
    .filter((result) => result.status === 'Success')
    .map((result) => result.migrationName);

  if (resultSet.error !== undefined) {
    return {
      appliedMigrationNames,
      backupBranch,
      error: resultSet.error,
      kind: 'migration-failed',
    };
  }

  return { appliedMigrationNames, backupBranch, kind: 'migrated' };
}

async function checkMigrationHistory(databaseURL: string): Promise<MigrationRun> {
  // the pending list holds only the migration files on disk, so a recorded migration whose file is
  // gone shows nothing pending; applying to the latest finds that gap and applies nothing
  const resultSet = await applyMigrations({ databaseURL });

  if (resultSet.error !== undefined) {
    return { error: resultSet.error, kind: 'history-check-failed' };
  }

  return { kind: 'up-to-date' };
}
