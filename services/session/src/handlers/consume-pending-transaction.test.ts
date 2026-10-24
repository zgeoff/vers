import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { SessionContract } from '@vers/contract-session';
import type { Isolation } from '@vers/service-test-utils/bun';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { sql } from 'kysely';
import { createSessionService } from '../create-session-service';
import { createPendingTransactionRow } from '../test-utils/create-pending-transaction-row';
import { createSessionRow } from '../test-utils/create-session-row';

interface SetupTestConfig {
  readonly isolation?: Isolation;
}

async function setupTest(config: SetupTestConfig = {}) {
  const db = await createTestDB({ isolation: config.isolation ?? 'transaction' });
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it consumes a matching pending transaction and returns a grant token', async () => {
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

  expect(result).toStrictEqual({ token: expect.stringMatching(/^[\w-]{43}$/u) });
});

test('it stores the grant under its token hash with the transaction action, target and session', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: session.id,
    target: created.user.id,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const issuedAt = new Date();

  const grant = await client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: session.id,
    target: created.user.id,
  });

  const rows = await ctx.db.selectFrom('stepUpGrants').selectAll().execute();

  expect(rows).toStrictEqual([
    {
      action: 'ChangePassword',
      createdAt: expect.toBeDate(),
      expiresAt: expect.toBeAfter(issuedAt),
      sessionId: session.id,
      target: created.user.id,
      tokenHash: createHash('sha256').update(grant.token).digest('hex'),
    },
  ]);
});

test('it sweeps expired grants when it issues a new one', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('stepUpGrants')
    .values({
      action: 'ChangeEmail',
      expiresAt: new Date(Date.now() - 1000),
      sessionId: null,
      target: 'expired@example.com',
      tokenHash: 'expired-hash',
    })
    .execute();

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

  const expired = await ctx.db
    .selectFrom('stepUpGrants')
    .selectAll()
    .where('tokenHash', '=', 'expired-hash')
    .executeTakeFirst();

  expect(expired).toBeUndefined();
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

test.each([
  ['action', { action: 'ChangeEmail', ipAddress: '127.0.0.1', sessionID: null, target: 'issued' }],
  [
    'ipAddress',
    { action: 'ChangePassword', ipAddress: '10.0.0.9', sessionID: null, target: 'issued' },
  ],
  [
    'sessionID',
    {
      action: 'ChangePassword',
      ipAddress: '127.0.0.1',
      sessionID: 'other-session',
      target: 'issued',
    },
  ],
  [
    'target',
    { action: 'ChangePassword', ipAddress: '127.0.0.1', sessionID: null, target: 'other' },
  ],
] as const)('it reports a mismatched %s and issues no grant', async (field, presented) => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: 'issued',
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(
    client.stepUp.consumePendingTransaction({ ...presented, id: transaction.id }),
  ).rejects.toMatchObject({ code: 'TRANSACTION_MISMATCH', data: { field } });

  const grants = await ctx.db.selectFrom('stepUpGrants').selectAll().execute();

  expect(grants).toBeEmpty();
});

test('it keeps the pending transaction when issuing its grant fails', async () => {
  await using ctx = await setupTest({ isolation: 'schema' });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: 'kept@example.com',
  });

  await sql`ALTER TABLE step_up_grants ADD CONSTRAINT refuse_every_grant CHECK (false)`.execute(
    ctx.db,
  );

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const failure = await client.stepUp
    .consumePendingTransaction({
      action: 'ChangePassword',
      id: transaction.id,
      ipAddress: '127.0.0.1',
      sessionID: null,
      target: 'kept@example.com',
    })
    .then(
      () => null,
      (error: unknown) => error,
    );

  const kept = await ctx.db
    .selectFrom('pendingTransactions')
    .select('id')
    .where('id', '=', transaction.id)
    .executeTakeFirst();

  expect(failure).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  expect(kept).toStrictEqual({ id: transaction.id });
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
