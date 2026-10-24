import { match } from 'ts-pattern';
import { z } from 'zod';
import { buildBackupBranchName } from '../migrate/build-backup-branch-name';
import { runMigrationsWithBackup } from '../migrate/run-migrations-with-backup';

const BACKUP_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const OPERATION_POLL_INTERVAL_MS = 2000;
const OPERATION_TIMEOUT_MS = 5 * 60 * 1000;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  GITHUB_RUN_ATTEMPT: z.string().min(1),
  GITHUB_RUN_ID: z.string().min(1),
  GITHUB_SHA: z.string().min(1),
  NEON_API_KEY: z.string().min(1),
  NEON_PROJECT_ID: z.string().min(1),
});

async function runProductionMigrations(): Promise<number> {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.'));

    console.error(`❌ missing or empty env: ${keys.join(', ')}; no migration applied`);

    return 1;
  }

  const env = parsed.data;

  const run = await runMigrationsWithBackup({
    backup: {
      apiKey: env.NEON_API_KEY,
      expiresAt: new Date(Date.now() + BACKUP_RETENTION_MS),
      name: buildBackupBranchName({
        commitSHA: env.GITHUB_SHA,
        runAttempt: env.GITHUB_RUN_ATTEMPT,
        runID: env.GITHUB_RUN_ID,
      }),
      operationPollIntervalMs: OPERATION_POLL_INTERVAL_MS,
      operationTimeoutMs: OPERATION_TIMEOUT_MS,
      projectID: env.NEON_PROJECT_ID,
    },
    databaseURL: env.DATABASE_URL,
    onBackupCreated: (branch, pendingMigrationNames) => {
      const consoleURL = `https://console.neon.tech/app/projects/${env.NEON_PROJECT_ID}/branches/${branch.id}`;

      console.log(
        `::notice title=Database backup::Neon branch ${branch.name} (${branch.id}) holds the database before ${pendingMigrationNames.join(', ')}: ${consoleURL}`,
      );
    },
  });

  return match(run)
    .with({ kind: 'up-to-date' }, () => {
      console.log('no pending migrations; no backup taken');

      return 0;
    })
    .with({ kind: 'migrated' }, (migrated) => {
      console.log(`✅ applied ${migrated.appliedMigrationNames.join(', ')}`);

      return 0;
    })
    .with({ kind: 'migration-failed' }, (failed) => {
      console.error(
        `❌ migration failed after applying [${failed.appliedMigrationNames.join(', ')}]; restore from Neon branch ${failed.backupBranch.name}`,
      );

      console.error(failed.error);

      return 1;
    })
    .exhaustive();
}

try {
  process.exitCode = await runProductionMigrations();
} catch (error) {
  console.error('❌ backup or migration step failed');
  console.error(error);

  process.exitCode = 1;
}
