import { expect, test } from 'bun:test';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createSessionService } from '../create-session-service';
import { createPendingTransactionRow } from '../test-utils/create-pending-transaction-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns an existing pending transaction by id', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.stepUp.getPendingTransaction({ id: transaction.id });

  expect(found).toStrictEqual({
    action: 'TwoFactorAuth',
    attempts: transaction.attempts,
    expiresAt: transaction.expiresAt,
    id: transaction.id,
    ipAddress: transaction.ipAddress,
    sessionID: transaction.sessionId,
    target: transaction.target,
  });
});

test('it returns null for an id that does not exist', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.stepUp.getPendingTransaction({ id: 'does-not-exist' });

  expect(found).toBeNull();
});

test('it lazy-deletes and returns null for an expired transaction', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    expiresAt: new Date(Date.now() - 1000),
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.stepUp.getPendingTransaction({ id: transaction.id });

  expect(found).toBeNull();

  const row = await ctx.db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', transaction.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it never increments attempts while reading', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await client.stepUp.getPendingTransaction({ id: transaction.id });
  await client.stepUp.getPendingTransaction({ id: transaction.id });

  const row = await ctx.db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', transaction.id)
    .executeTakeFirstOrThrow();

  expect(row.attempts).toBe(0);
});
