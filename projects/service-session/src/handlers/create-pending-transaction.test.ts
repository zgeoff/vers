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

test('it creates a pending transaction under the given id', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const result = await client.stepUp.createPendingTransaction({
    action: 'TwoFactorAuth',
    id: 'pending-1',
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user@example.com',
  });

  expect(result).toStrictEqual({
    action: 'TwoFactorAuth',
    attempts: 0,
    expiresAt: expect.toBeDate(),
    id: 'pending-1',
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user@example.com',
  });
});

test('it throws CONFLICT when the id is already in use', async () => {
  await using ctx = await setupTest();

  await createPendingTransactionRow(ctx.db, { id: 'taken' });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  // a rejected insert aborts the shared transaction handle — this must be the test's last query
  expect(
    client.stepUp.createPendingTransaction({
      action: 'TwoFactorAuth',
      id: 'taken',
      ipAddress: '127.0.0.1',
      sessionID: null,
      target: 'user@example.com',
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});

test('it sweeps expired pending transactions before creating a new one', async () => {
  await using ctx = await setupTest();

  await createPendingTransactionRow(ctx.db, {
    expiresAt: new Date(Date.now() - 1000),
    id: 'expired',
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await client.stepUp.createPendingTransaction({
    action: 'TwoFactorAuth',
    id: 'fresh',
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'user@example.com',
  });

  const row = await ctx.db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', 'expired')
    .executeTakeFirst();

  expect(row).toBeUndefined();
});
