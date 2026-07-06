import { expect, test } from 'bun:test';
import { createDB } from '@vers/db';
import { createDatabaseFromTemplate } from './create-database-from-template';

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
