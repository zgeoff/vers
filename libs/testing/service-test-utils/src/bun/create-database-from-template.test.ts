import { expect, onTestFinished, test } from 'bun:test';
import { createDB } from '@vers/db';
import postgres from 'postgres';
import { createDatabaseFromTemplate } from './create-database-from-template';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it creates a freshly named, independently connectable database from the template', async () => {
  const databaseURL = await createDatabaseFromTemplate();

  expect(databaseURL).toInclude('test_');

  await using db = createDB({ databaseURL });

  const rows = await db.selectFrom('users').selectAll().execute();

  expect(rows).toBeEmpty();
});

test('it creates a distinct database on every call', async () => {
  const [first, second] = await Promise.all([
    createDatabaseFromTemplate(),
    createDatabaseFromTemplate(),
  ]);

  expect(first).not.toBe(second);
});

test('it drops the database once the test and its own cleanups are done', async () => {
  const databaseURL = await createDatabaseFromTemplate();

  const databaseName = new URL(databaseURL).pathname.slice(1);

  const admin = postgres(`${resolveTestDBTarget().baseURI}/postgres`);
  const db = createDB({ databaseURL });

  const readExists = async () => {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;

    return rows.length > 0;
  };

  onTestFinished(async () => {
    const existsBeforeDrop = await readExists();

    expect(existsBeforeDrop).toBe(true);

    await db.destroy();

    onTestFinished(async () => {
      const existsAfterDrop = await readExists();

      expect(existsAfterDrop).toBe(false);

      await admin.end();
    });
  });

  await db.selectFrom('users').selectAll().execute();
});
