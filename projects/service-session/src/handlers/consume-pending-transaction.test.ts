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

test('it consumes a matching pending transaction and returns its data', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'TwoFactorAuth',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: 'user@example.com',
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const result = await client.stepUp.consumePendingTransaction({
    action: 'TwoFactorAuth',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user@example.com',
  });

  expect(result).toStrictEqual({
    action: 'TwoFactorAuth',
    attempts: 0,
    expiresAt: transaction.expiresAt,
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user@example.com',
  });
});

test('it throws NOT_FOUND when consuming the same pending transaction twice', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await client.stepUp.consumePendingTransaction({
    action: 'TwoFactorAuth',
    id: transaction.id,
    ipAddress: transaction.ipAddress,
    sessionID: transaction.sessionId,
    target: transaction.target,
  });

  expect(
    client.stepUp.consumePendingTransaction({
      action: 'TwoFactorAuth',
      id: transaction.id,
      ipAddress: transaction.ipAddress,
      sessionID: transaction.sessionId,
      target: transaction.target,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it throws TRANSACTION_MISMATCH and still burns the transaction when a field does not match', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'TwoFactorAuth',
    target: 'user@example.com',
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(
    client.stepUp.consumePendingTransaction({
      action: 'TwoFactorAuth',
      id: transaction.id,
      ipAddress: transaction.ipAddress,
      sessionID: transaction.sessionId,
      target: 'someone-else@example.com',
    }),
  ).rejects.toMatchObject({ code: 'TRANSACTION_MISMATCH', data: { field: 'target' } });

  const row = await ctx.db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', transaction.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it throws NOT_FOUND for a transaction that does not exist', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(
    client.stepUp.consumePendingTransaction({
      action: 'TwoFactorAuth',
      id: 'does-not-exist',
      ipAddress: '127.0.0.1',
      sessionID: null,
      target: 'user@example.com',
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
