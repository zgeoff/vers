import { expect, test } from 'bun:test';
import { buildBackupBranchName } from './build-backup-branch-name';

test('it names the backup branch for the short commit, the run and its attempt', () => {
  expect(
    buildBackupBranchName({
      commitSHA: '4f1c9a2be07d58c3a6e19f0b2d7c4e8a1b3f5d60',
      runAttempt: '2',
      runID: '18234567890',
    }),
  ).toBe('pre-migrate-4f1c9a2be07d-run-18234567890-2');
});
