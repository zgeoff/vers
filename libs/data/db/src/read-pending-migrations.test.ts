import { expect, onTestFinished, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { applyMigrations } from './apply-migrations';
import { migrationsFolder } from './build-migrator';
import { readPendingMigrations } from './read-pending-migrations';
import { removeTestDatabase } from './test-support/remove-test-database';
import { resolveTestDBTarget } from './test-support/resolve-test-db-target';

async function setupTest() {
  const baseURI = resolveTestDBTarget().baseURI;
  const dbName = `test_${createId()}`;
  const setupClient = postgres(`${baseURI}/postgres`);

  await setupClient.unsafe(`CREATE DATABASE ${dbName}`);
  await setupClient.end();

  const databaseURL = `${baseURI}/${dbName}`;

  onTestFinished(() => removeTestDatabase(databaseURL));

  return { databaseURL };
}

test('it lists every migration file as pending on an empty database', async () => {
  const ctx = await setupTest();
  const migrationFiles = await readdir(migrationsFolder);
  const pending = await readPendingMigrations({ databaseURL: ctx.databaseURL });

  expect(pending).toStrictEqual(
    migrationFiles.map((file) => file.replace(/\.ts$/u, '')).toSorted(),
  );
});

test('it lists no pending migration once every migration is applied', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const pending = await readPendingMigrations({ databaseURL: ctx.databaseURL });

  expect(pending).toBeEmpty();
});
