import { expect, onTestFinished, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { removeTestDatabase } from './remove-test-database';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it drops a database that still has an open connection', async () => {
  const baseURI = resolveTestDBTarget().baseURI;
  const dbName = `test_remove_${createId()}`;
  const admin = postgres(`${baseURI}/postgres`);

  onTestFinished(() => admin.end());

  await admin.unsafe(`CREATE DATABASE ${dbName}`);

  const lingering = postgres(`${baseURI}/${dbName}`, { max: 1 });

  onTestFinished(() => lingering.end());

  await lingering`SELECT 1`;
  await removeTestDatabase(`${baseURI}/${dbName}`);

  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;

  expect(rows).toBeEmpty();
});

test('it is a no-op for a database that does not exist', async () => {
  const baseURI = resolveTestDBTarget().baseURI;

  await expect(removeTestDatabase(`${baseURI}/test_missing_${createId()}`)).toResolve();
});

test('it rejects a database name that is not a safe identifier', () => {
  const baseURI = resolveTestDBTarget().baseURI;

  expect(removeTestDatabase(`${baseURI}/postgres;DROP`)).rejects.toThrow(
    'invalid database identifier',
  );
});
