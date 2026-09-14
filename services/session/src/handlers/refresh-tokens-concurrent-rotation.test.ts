import { expect, test } from 'bun:test';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { SESSION_DURATION_SHORT } from '../consts';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';

// the test drives two concurrent connections against one committed row, which the default
// transaction handle cannot host
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it converges two concurrent rotations on one refresh token', async () => {
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

  const [first, second] = await Promise.all([
    client.refreshTokens({ id: session.id, refreshToken: 'old-token' }),
    client.refreshTokens({ id: session.id, refreshToken: 'old-token' }),
  ]);

  expect(first.refreshToken).toBe(second.refreshToken);

  const row = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow();

  expect(row.refreshToken).toBe(first.refreshToken);
});
