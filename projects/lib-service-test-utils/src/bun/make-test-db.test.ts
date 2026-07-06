import { expect, test } from 'bun:test';
import { makeTestDB } from './make-test-db';

test('it throws when the default isolation is not itself enabled', () => {
  expect(() => makeTestDB({ default: 'database', enabled: ['transaction'] })).toThrow(
    /default 'database' not in enabled/,
  );
});

test('it throws when a caller requests an isolation absent from enabled', () => {
  const createTestDB = makeTestDB({ default: 'transaction', enabled: ['transaction'] });

  expect(() => createTestDB({ isolation: 'database' })).toThrow(/'database' not in enabled/);
});

test('it acquires the declared default isolation when none is requested', async () => {
  const createTestDB = makeTestDB({
    default: 'transaction',
    enabled: ['transaction', 'database'],
  });

  await using testDB = await createTestDB();
  const rows = await testDB.db.selectFrom('users').selectAll().execute();

  expect(rows).toBeArray();
});

test('it acquires an explicitly requested isolation from those enabled', async () => {
  const createTestDB = makeTestDB({
    default: 'transaction',
    enabled: ['transaction', 'database'],
  });

  await using testDB = await createTestDB({ isolation: 'database' });
  const rows = await testDB.db.selectFrom('users').selectAll().execute();

  expect(rows).toBeArray();
});
