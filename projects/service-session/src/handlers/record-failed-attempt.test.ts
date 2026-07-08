import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createSessionService } from '../create-session-service';
import { createPendingTransactionRow } from '../test-utils/create-pending-transaction-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it leaves the pending transaction intact through the fourth failure', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  let result;

  for (let attempt = 0; attempt < 4; attempt++) {
    result = await client.stepUp.recordFailedAttempt({ id: transaction.id });
  }

  expect(result).toStrictEqual({ attemptsRemaining: 1 });

  const row = await ctx.db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', transaction.id)
    .executeTakeFirst();

  expect(row).not.toBeUndefined();
});

test('it deletes the pending transaction after the fifth failed attempt', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  let result;

  for (let attempt = 0; attempt < 5; attempt++) {
    result = await client.stepUp.recordFailedAttempt({ id: transaction.id });
  }

  expect(result).toStrictEqual({ attemptsRemaining: 0 });

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

  expect(client.stepUp.recordFailedAttempt({ id: 'does-not-exist' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it throws NOT_FOUND for an expired transaction', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    expiresAt: new Date(Date.now() - 1000),
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(client.stepUp.recordFailedAttempt({ id: transaction.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
