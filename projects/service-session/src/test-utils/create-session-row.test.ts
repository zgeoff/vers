import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createSessionRow } from './create-session-row';

test('it inserts a session row owned by the given user', async () => {
  await using testDB = await createTestDB();
  const created = await createTestUser(testDB.db);
  const user = created.user;

  const session = await createSessionRow(testDB.db, { userId: user.id });

  const row = await testDB.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow();

  expect(row.userId).toBe(user.id);
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();
  const created = await createTestUser(testDB.db);
  const user = created.user;

  const createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const session = await createSessionRow(testDB.db, { createdAt, userId: user.id });

  expect(session).toMatchObject({ createdAt });
});
