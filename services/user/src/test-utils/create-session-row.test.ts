import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createSessionRow } from './create-session-row';

test('it inserts a session row for a given owner with faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const created = await createTestUser(testDB.db);

  const session = await createSessionRow(testDB.db, { userId: created.user.id });

  const row = await testDB.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow();

  expect(row.userId).toBe(created.user.id);
});
