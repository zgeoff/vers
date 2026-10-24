import { expect, test } from 'bun:test';
import { formatMigrationFailure } from './format-migration-failure';

test('it reports that no restore is needed when no migration of the run persisted', () => {
  expect(
    formatMigrationFailure({
      backupBranch: { id: 'br-calm-lake-1', name: 'pre-migrate-4f1c9a2be07d-run-1-1' },
      error: new Error('relation "sessions" already exists'),
      failedMigrationName: '1783000000002_sessions',
      kind: 'migration-failed',
      persistedMigrationNames: [],
    }),
  ).toBe(
    '❌ migration 1783000000002_sessions failed; the database still lists every migration of this run as pending, so none persisted and no restore is needed',
  );
});

test('it names the persisted migrations and the backup branch when some persisted', () => {
  expect(
    formatMigrationFailure({
      backupBranch: { id: 'br-calm-lake-1', name: 'pre-migrate-4f1c9a2be07d-run-1-1' },
      error: new Error('relation "sessions" already exists'),
      failedMigrationName: '1783000000002_sessions',
      kind: 'migration-failed',
      persistedMigrationNames: ['1783000000001_users'],
    }),
  ).toBe(
    '❌ migration 1783000000002_sessions failed after 1783000000001_users persisted; Neon branch pre-migrate-4f1c9a2be07d-run-1-1 holds the database before them (docs/runbooks/database-restore.md)',
  );
});
