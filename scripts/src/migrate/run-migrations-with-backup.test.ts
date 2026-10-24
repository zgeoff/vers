import { expect, mock, onTestFinished, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { applyMigrations, migrationsFolder, readPendingMigrations } from '@vers/db';
import { removeTestDatabase, resolveTestDBTarget } from '@vers/db/test-support';
import { HttpResponse, http } from 'msw';
import postgres from 'postgres';
import { neonBranchCollection, server } from '../mocks/node';
import { NEON_API_ORIGIN } from './request-neon-json';
import { runMigrationsWithBackup } from './run-migrations-with-backup';
import type { NeonBranch } from './types';

async function setupTest() {
  const baseURI = resolveTestDBTarget().baseURI;
  const dbName = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = postgres(`${baseURI}/postgres`, { max: 1 });

  await admin.unsafe(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const databaseURL = `${baseURI}/${dbName}`;

  onTestFinished(() => removeTestDatabase(databaseURL));

  const migrationFiles = await readdir(migrationsFolder);

  const migrationNames = migrationFiles.map((file) => file.replace(/\.ts$/u, '')).toSorted();

  return { databaseURL, migrationNames };
}

test('it backs up the database and then applies every pending migration', async () => {
  const ctx = await setupTest();

  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  const onBackupCreated = mock<(branch: NeonBranch, names: ReadonlyArray<string>) => void>();

  const run = await runMigrationsWithBackup({
    backup: {
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    },
    databaseURL: ctx.databaseURL,
    onBackupCreated,
  });

  expect(run).toStrictEqual({
    appliedMigrationNames: ctx.migrationNames,
    backupBranch: { id: expect.toStartWith('br-'), name: 'pre-migrate-4f1c9a2be07d-run-1-1' },
    kind: 'migrated',
  });

  expect(onBackupCreated).toHaveBeenCalledExactlyOnceWith(
    { id: expect.toStartWith('br-'), name: 'pre-migrate-4f1c9a2be07d-run-1-1' },
    ctx.migrationNames,
  );

  const pending = await readPendingMigrations({ databaseURL: ctx.databaseURL });

  expect(pending).toBeEmpty();
});

test('it applies no migration when the backup fails', async () => {
  const ctx = await setupTest();

  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  server.use(
    http.post(`${NEON_API_ORIGIN}/projects/:projectID/branches`, () =>
      HttpResponse.json({ code: '', message: 'branches limit exceeded' }, { status: 422 }),
    ),
  );

  const failure = await runMigrationsWithBackup({
    backup: {
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    },
    databaseURL: ctx.databaseURL,
    onBackupCreated: () => {},
  }).then(
    () => null,
    (error: unknown) => error,
  );

  const pending = await readPendingMigrations({ databaseURL: ctx.databaseURL });

  expect(failure).toMatchObject({ name: 'NeonRequestError', status: 422 });
  expect(pending).toStrictEqual(ctx.migrationNames);
});

test('it takes no backup when no migration is pending', async () => {
  const ctx = await setupTest();

  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const run = await runMigrationsWithBackup({
    backup: {
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    },
    databaseURL: ctx.databaseURL,
    onBackupCreated: () => {},
  });

  expect(run).toStrictEqual({ kind: 'up-to-date' });
  expect(neonBranchCollection.findMany()).toHaveLength(1);
});

test('it fails the history check when a recorded migration has no file, with no backup', async () => {
  const ctx = await setupTest();

  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const history = postgres(ctx.databaseURL, { max: 1 });

  onTestFinished(() => history.end());

  await history.unsafe(
    "INSERT INTO kysely_migration (name, timestamp) VALUES ('1799000000000_removed_file', now()::text)",
  );

  const run = await runMigrationsWithBackup({
    backup: {
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    },
    databaseURL: ctx.databaseURL,
    onBackupCreated: () => {},
  });

  expect(run).toStrictEqual({
    error: expect.objectContaining({
      message:
        'corrupted migrations: previously executed migration 1799000000000_removed_file is missing',
    }),
    kind: 'history-check-failed',
  });

  expect(neonBranchCollection.findMany()).toHaveLength(1);
});

test('it reports no persisted migration when a failed run rolled back as one transaction', async () => {
  const ctx = await setupTest();

  const conflicting = postgres(ctx.databaseURL, { max: 1 });

  onTestFinished(() => conflicting.end());

  await conflicting.unsafe('CREATE TABLE sessions (id text PRIMARY KEY)');
  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  const run = await runMigrationsWithBackup({
    backup: {
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    },
    databaseURL: ctx.databaseURL,
    onBackupCreated: () => {},
  });

  const pending = await readPendingMigrations({ databaseURL: ctx.databaseURL });

  expect(run).toStrictEqual({
    backupBranch: { id: expect.toStartWith('br-'), name: 'pre-migrate-4f1c9a2be07d-run-1-1' },
    error: expect.objectContaining({ message: 'relation "sessions" already exists' }),
    failedMigrationName: '1783000000002_sessions',
    kind: 'migration-failed',
    persistedMigrationNames: [],
  });

  expect(pending).toStrictEqual(ctx.migrationNames);
});
