import type { MigrationRun } from './types';

type MigrationFailure = Extract<MigrationRun, { kind: 'migration-failed' }>;

export function formatMigrationFailure(failure: MigrationFailure): string {
  const failed = `❌ migration ${failure.failedMigrationName ?? '(unknown)'} failed`;

  if (failure.persistedMigrationNames.length === 0) {
    return `${failed}; the database still lists every migration of this run as pending, so none persisted and no restore is needed`;
  }

  return `${failed} after ${failure.persistedMigrationNames.join(', ')} persisted; Neon branch ${failure.backupBranch.name} holds the database before them (docs/runbooks/database-restore.md)`;
}
