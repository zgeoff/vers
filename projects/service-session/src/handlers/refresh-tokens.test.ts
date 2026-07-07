import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { SESSION_DURATION_SHORT } from '../consts';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the same refresh token within the grace window', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);

  const session = await createSessionRow(ctx.db, {
    refreshToken: 'fresh-token',
    userId: created.user.id,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const result = await client.refreshTokens({ id: session.id, refreshToken: 'fresh-token' });

  expect(result).toStrictEqual({ accessToken: expect.toBeString(), refreshToken: 'fresh-token' });
});

test('it rotates the refresh token after the grace window and records the previous one', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);

  const createdAt = new Date(Date.now() - SESSION_DURATION_SHORT - 1000);

  const session = await createSessionRow(ctx.db, {
    createdAt,
    refreshToken: 'old-token',
    userId: created.user.id,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const result = await client.refreshTokens({ id: session.id, refreshToken: 'old-token' });

  expect(result.refreshToken).not.toBe('old-token');

  const row = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow();

  expect(row.refreshToken).toBe(result.refreshToken);
  expect(row.previousRefreshToken).toBe('old-token');
});

test('it revokes the session and throws REFRESH_TOKEN_REUSED when a superseded refresh token is presented', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);

  const createdAt = new Date(Date.now() - SESSION_DURATION_SHORT - 1000);

  const session = await createSessionRow(ctx.db, {
    createdAt,
    refreshToken: 'old-token',
    userId: created.user.id,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await client.refreshTokens({ id: session.id, refreshToken: 'old-token' });

  expect(client.refreshTokens({ id: session.id, refreshToken: 'old-token' })).rejects.toMatchObject(
    { code: 'REFRESH_TOKEN_REUSED' },
  );

  const row = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it deletes the session and throws SESSION_EXPIRED for an expired session', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);

  const session = await createSessionRow(ctx.db, {
    expiresAt: new Date(Date.now() - 1000),
    refreshToken: 'expired-token',
    userId: created.user.id,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(
    client.refreshTokens({ id: session.id, refreshToken: 'expired-token' }),
  ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

  const row = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it throws NOT_FOUND for a session that does not exist', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(
    client.refreshTokens({ id: 'does-not-exist', refreshToken: 'anything' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it throws NOT_FOUND when the presented refresh token does not match', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);

  const session = await createSessionRow(ctx.db, {
    refreshToken: 'real-token',
    userId: created.user.id,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(
    client.refreshTokens({ id: session.id, refreshToken: 'wrong-token' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
