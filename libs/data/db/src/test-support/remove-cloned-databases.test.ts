import { expect, onTestFinished, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createClonedDatabase } from './create-cloned-database';
import { removeClonedDatabases } from './remove-cloned-databases';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it drops every database the process cloned', async () => {
  const target = resolveTestDBTarget();
  const dbNames = [`test_clone_${createId()}`, `test_clone_${createId()}`];
  const admin = postgres(`${target.baseURI}/postgres`);

  onTestFinished(() => admin.end());

  await Promise.all(
    dbNames.map((dbName) =>
      createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB }),
    ),
  );

  await removeClonedDatabases();

  const rows = await admin`SELECT datname FROM pg_database WHERE datname IN ${admin(dbNames)}`;

  expect(rows).toBeEmpty();
});
