import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createDB } from './create-db';
import { migrateToLatest } from './migrate-to-latest';
import { resolveTestDBTarget } from './test-support/resolve-test-db-target';

/**
 * Creates a freshly minted, unmigrated database — the state `migrateToLatest`
 * expects to find before it has ever run.
 */
async function createEmptyDB() {
  const baseURI = resolveTestDBTarget().baseURI;
  const dbName = `test_${createId()}`;

  const setupClient = postgres(`${baseURI}/postgres`);

  await setupClient.unsafe(/* SQL */ `CREATE DATABASE ${dbName}`);
  await setupClient.end();

  return `${baseURI}/${dbName}`;
}

test('it applies pending migrations once and is a no-op the second time', async () => {
  const databaseURL = await createEmptyDB();

  const first = await migrateToLatest({ databaseURL });

  expect(first.error).toBeUndefined();
  expect(first.results).not.toBeEmpty();

  const second = await migrateToLatest({ databaseURL });

  expect(second.error).toBeUndefined();
  expect(second.results).toBeEmpty();
});

test('it creates the pending_transactions table with defaults applied', async () => {
  const databaseURL = await createEmptyDB();

  await migrateToLatest({ databaseURL });

  const db = createDB({ databaseURL });

  const inserted = await db
    .insertInto('pendingTransactions')
    .values({
      action: 'test-action',
      expiresAt: new Date(Date.now() + 60_000),
      id: 'ptx_test',
      ipAddress: '127.0.0.1',
      target: 'test-target',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(inserted.attempts).toBe(0);
  expect(inserted.sessionId).toBeNull();
  expect(inserted.createdAt).toBeInstanceOf(Date);

  await db.destroy();
});

test('it adds the consumed-transaction-token table and audit columns', async () => {
  const databaseURL = await createEmptyDB();

  await migrateToLatest({ databaseURL });

  const db = createDB({ databaseURL });

  const token = await db
    .insertInto('consumedTransactionTokens')
    .values({ expiresAt: new Date(Date.now() + 60_000), jti: 'jti_test' })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(token.jti).toBe('jti_test');
  expect(token.createdAt).toBeInstanceOf(Date);

  await db
    .insertInto('users')
    .values({ email: 'cols@example.com', id: 'usr_cols', name: 'Cols', username: 'cols' })
    .execute();

  const session = await db
    .insertInto('sessions')
    .values({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'ses_cols',
      ipAddress: '127.0.0.1',
      userId: 'usr_cols',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(session.previousRefreshToken).toBeNull();

  const verification = await db
    .insertInto('verifications')
    .values({
      algorithm: 'SHA-256',
      charSet: '0123456789',
      digits: 6,
      id: 'ver_cols',
      period: 30,
      secret: 'secret',
      target: 'cols@example.com',
      type: '2fa',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(verification.lastVerifiedCode).toBeNull();
  expect(verification.lastVerifiedAt).toBeNull();

  await db.destroy();
});

test('it bumps updated_at through the set_updated_at trigger on update', async () => {
  const databaseURL = await createEmptyDB();

  await migrateToLatest({ databaseURL });

  const db = createDB({ databaseURL });

  const staleDate = new Date('2020-01-01T00:00:00.000Z');

  const inserted = await db
    .insertInto('users')
    .values({
      createdAt: staleDate,
      email: 'trigger@example.com',
      id: 'usr_trigger',
      name: 'Trigger',
      updatedAt: staleDate,
      username: 'trigger',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const updated = await db
    .updateTable('users')
    .set({ name: 'Trigger Updated' })
    .where('id', '=', 'usr_trigger')
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(updated.updatedAt).toBeAfter(inserted.updatedAt);

  await db.destroy();
});
