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
    return { kind: 'up-to-date' };
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
