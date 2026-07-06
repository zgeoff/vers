import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createSessionService } from '../create-session-service';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createSessionService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it reports consumed=true the first time a jti is presented', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const result = await client.stepUp.consumeTransactionToken({
    expiresAt: new Date(Date.now() + 60 * 1000),
    jti: 'jti-1',
  });

  expect(result).toStrictEqual({ consumed: true });
});

test('it reports consumed=false the second time the same jti is presented', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const expiresAt = new Date(Date.now() + 60 * 1000);

  await client.stepUp.consumeTransactionToken({ expiresAt, jti: 'jti-2' });

  const result = await client.stepUp.consumeTransactionToken({ expiresAt, jti: 'jti-2' });

  expect(result).toStrictEqual({ consumed: false });
});

test('it still blocks a jti more than five minutes after first use', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('consumedTransactionTokens')
    .values({
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      jti: 'long-lived-jti',
    })
    .execute();

  const { token } = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const result = await client.stepUp.consumeTransactionToken({
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    jti: 'long-lived-jti',
  });

  expect(result).toStrictEqual({ consumed: false });
});

test('it sweeps expired consumed-token rows before checking for a replay', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('consumedTransactionTokens')
    .values({ expiresAt: new Date(Date.now() - 1000), jti: 'already-expired' })
    .execute();

  const { token } = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  await client.stepUp.consumeTransactionToken({
    expiresAt: new Date(Date.now() + 60 * 1000),
    jti: 'unrelated',
  });

  const row = await ctx.db
    .selectFrom('consumedTransactionTokens')
    .selectAll()
    .where('jti', '=', 'already-expired')
    .executeTakeFirst();

  expect(row).toBeUndefined();
});
