import { expect, onTestFinished, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createClonedDatabase } from './create-cloned-database';
import { removeOrphanedClones } from './remove-orphaned-clones';
import { removeTestDatabase } from './remove-test-database';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it drops a clone whose owning process has ended', async () => {
  const target = resolveTestDBTarget();
  const ended = Bun.spawn(['true']);

  await ended.exited;

  const dbName = `test_pid_${ended.pid}_${createId()}`;
  const admin = postgres(`${target.baseURI}/postgres`);

  onTestFinished(() => admin.end());

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  onTestFinished(() => removeTestDatabase(`${target.baseURI}/${dbName}`));

  await removeOrphanedClones(target.baseURI);

  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;

  expect(rows).toBeEmpty();
});

test('it keeps a clone whose owning process is alive', async () => {
  const target = resolveTestDBTarget();
  const dbName = `test_pid_${process.pid}_${createId()}`;
  const admin = postgres(`${target.baseURI}/postgres`);

  onTestFinished(() => admin.end());

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  onTestFinished(() => removeTestDatabase(`${target.baseURI}/${dbName}`));

  const removed = await removeOrphanedClones(target.baseURI);
  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;

  expect(removed).not.toContain(dbName);
  expect(rows).toHaveLength(1);
});
