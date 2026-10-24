import { expect, onTestFinished, test } from 'bun:test';
import { join } from 'node:path';
import type { SessionContract } from '@vers/contract-session';
import { createDB } from '@vers/db';
import { removeTestDatabase } from '@vers/db/test-support';
import {
  createAnonymousViewer,
  createDatabaseFromTemplate,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { buildGrantTokenHash } from '../build-grant-token-hash';
import { createSessionService } from '../create-session-service';
import { createPendingTransactionRow } from '../test-utils/create-pending-transaction-row';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(service.app, { token: viewer.token });

  return { client, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it redeems a grant for the action, target and session it was issued for', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: session.id,
    target: created.user.id,
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: session.id,
    target: created.user.id,
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangePassword',
    sessionID: session.id,
    target: created.user.id,
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: true });
});

test('it refuses a grant presented a second time', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangeEmail',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: 'reuse@example.com',
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangeEmail',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'reuse@example.com',
  });

  await ctx.client.stepUp.consumeGrant({
    action: 'ChangeEmail',
    sessionID: null,
    target: 'reuse@example.com',
    token: grant.token,
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangeEmail',
    sessionID: null,
    target: 'reuse@example.com',
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it refuses an expired grant', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('stepUpGrants')
    .values({
      action: 'ChangeEmail',
      expiresAt: new Date(Date.now() - 1000),
      sessionId: null,
      target: 'expired@example.com',
      tokenHash: buildGrantTokenHash('expired-grant-token'),
    })
    .execute();

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangeEmail',
    sessionID: null,
    target: 'expired@example.com',
    token: 'expired-grant-token',
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it refuses a token that was never issued', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangeEmail',
    sessionID: null,
    target: 'unknown@example.com',
    token: 'never-issued-token',
  });

  expect(result).toStrictEqual({ consumed: false });
});

test.each([
  ['a different action', { action: 'ChangeEmail', target: 'issued' }],
  ['a different target', { action: 'ChangePassword', target: 'other' }],
] as const)('it refuses a grant presented for %s', async (_label, presented) => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: session.id,
    target: 'issued',
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: session.id,
    target: 'issued',
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: presented.action,
    sessionID: session.id,
    target: presented.target,
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it refuses a grant presented under another session', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const issuing = await createSessionRow(ctx.db, { userId: created.user.id });
  const other = await createSessionRow(ctx.db, { userId: created.user.id });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: issuing.id,
    target: created.user.id,
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: issuing.id,
    target: created.user.id,
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangePassword',
    sessionID: other.id,
    target: created.user.id,
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it refuses a session-bound grant presented with no session', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: session.id,
    target: created.user.id,
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: session.id,
    target: created.user.id,
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangePassword',
    sessionID: null,
    target: created.user.id,
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it refuses a grant issued with no session when presented under a session', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id });

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangeEmail',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: created.user.id,
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangeEmail',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: created.user.id,
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangeEmail',
    sessionID: session.id,
    target: created.user.id,
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it keeps a grant redeemable after a presentation for a different action', async () => {
  await using ctx = await setupTest();

  const transaction = await createPendingTransactionRow(ctx.db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: 'kept@example.com',
  });

  const grant = await ctx.client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'kept@example.com',
  });

  await ctx.client.stepUp.consumeGrant({
    action: 'ChangeEmail',
    sessionID: null,
    target: 'kept@example.com',
    token: grant.token,
  });

  const result = await ctx.client.stepUp.consumeGrant({
    action: 'ChangePassword',
    sessionID: null,
    target: 'kept@example.com',
    token: grant.token,
  });

  expect(result).toStrictEqual({ consumed: true });
});

test('it redeems in a fresh process a grant issued in this one', async () => {
  const databaseURL = await createDatabaseFromTemplate();

  const db = createDB({ databaseURL, resumeDetection: false });

  onTestFinished(async () => {
    await db.destroy();

    await removeTestDatabase(databaseURL);
  });

  const service = await createSessionService({ db });
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(service.app, { token: viewer.token });

  const transaction = await createPendingTransactionRow(db, {
    action: 'ChangePassword',
    ipAddress: '127.0.0.1',
    sessionId: null,
    target: 'fresh-process@example.com',
  });

  const grant = await client.stepUp.consumePendingTransaction({
    action: 'ChangePassword',
    id: transaction.id,
    ipAddress: '127.0.0.1',
    sessionID: null,
    target: 'fresh-process@example.com',
  });

  const child = Bun.spawn(
    [
      'bun',
      '-e',
      `
        const { createDB } = await import('@vers/db');
        const { consumeGrant } = await import(${JSON.stringify(join(import.meta.dir, 'consume-grant.ts'))});
        const db = createDB({ databaseURL: process.env.GRANT_DATABASE_URL, resumeDetection: false });
        const result = await consumeGrant(db, {
          input: {
            action: 'ChangePassword',
            sessionID: null,
            target: 'fresh-process@example.com',
            token: process.env.GRANT_TOKEN,
          },
        });
        await db.destroy();
        console.log(JSON.stringify(result));
      `,
    ],
    {
      cwd: join(import.meta.dir, '..', '..'),
      env: { ...process.env, GRANT_DATABASE_URL: databaseURL, GRANT_TOKEN: grant.token },
      stderr: 'inherit',
      stdout: 'pipe',
    },
  );

  const output = await new Response(child.stdout).text();

  const exitCode = await child.exited;

  expect(exitCode).toBe(0);
  expect(output.trim()).toBe('{"consumed":true}');
});
