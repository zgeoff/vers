import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { readSessionChecks } from './read-session-checks';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds no violation when each user holds one verified session with a refresh token', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);

  await ctx.db
    .insertInto('sessions')
    .values([
      {
        expiresAt: new Date(Date.now() + 86_400_000),
        id: 'session_verified',
        ipAddress: '203.0.113.7',
        refreshToken: 'refresh-current',
        userId: user.user.id,
        verified: true,
      },
      {
        expiresAt: new Date(Date.now() + 86_400_000),
        id: 'session_pending',
        ipAddress: '203.0.113.8',
        userId: user.user.id,
      },
    ])
    .execute();

  const checks = await readSessionChecks(ctx.db);

  expect(checks).toStrictEqual([
    { area: 'sessions', name: 'one verified session per user', violations: [] },
    { area: 'sessions', name: 'a verified session holds a refresh token', violations: [] },
  ]);
});

test('it reports a user who holds two verified sessions', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);

  await ctx.db
    .insertInto('sessions')
    .values([
      {
        expiresAt: new Date(Date.now() + 86_400_000),
        id: 'session_laptop',
        ipAddress: '203.0.113.7',
        refreshToken: 'refresh-laptop',
        userId: user.user.id,
        verified: true,
      },
      {
        expiresAt: new Date(Date.now() + 86_400_000),
        id: 'session_phone',
        ipAddress: '203.0.113.8',
        refreshToken: 'refresh-phone',
        userId: user.user.id,
        verified: true,
      },
    ])
    .execute();

  const checks = await readSessionChecks(ctx.db);

  expect(checks).toStrictEqual([
    {
      area: 'sessions',
      name: 'one verified session per user',
      violations: [`user ${user.user.id}`],
    },
    { area: 'sessions', name: 'a verified session holds a refresh token', violations: [] },
  ]);
});

test('it reports a verified session that holds no refresh token', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);

  await ctx.db
    .insertInto('sessions')
    .values({
      expiresAt: new Date(Date.now() + 86_400_000),
      id: 'session_tokenless',
      ipAddress: '203.0.113.7',
      userId: user.user.id,
      verified: true,
    })
    .execute();

  const checks = await readSessionChecks(ctx.db);

  expect(checks).toStrictEqual([
    { area: 'sessions', name: 'one verified session per user', violations: [] },
    {
      area: 'sessions',
      name: 'a verified session holds a refresh token',
      violations: ['session session_tokenless'],
    },
  ]);
});
