import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import * as jose from 'jose';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';
import { getTestJWTKeyPair } from '../test-utils/get-test-jwt-key-pair';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it verifies an unverified session and returns a token pair', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id, verified: false });
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const result = await client.verifySession({ id: session.id });

  expect(result).toStrictEqual({
    accessToken: expect.toBeString(),
    refreshToken: expect.toBeString(),
  });

  const verified = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow();

  expect(verified.verified).toBeTrue();
  expect(verified.refreshToken).toBe(result.refreshToken);
});

test("it mints tokens verifiable with the signing key's public half", async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const session = await createSessionRow(ctx.db, {
    expiresAt,
    userId: created.user.id,
    verified: false,
  });

  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const result = await client.verifySession({ id: session.id });

  const keyPair = await getTestJWTKeyPair();
  const publicKey = await jose.importSPKI(keyPair.publicKeyPEM, 'RS256');
  const accessVerification = await jose.jwtVerify(result.accessToken, publicKey);

  expect(accessVerification.payload.sub).toBe(created.user.id);
  expect(accessVerification.payload.iss).toBe('service-session-test');
  expect(accessVerification.payload.aud).toBe('service-session-test');

  expect(accessVerification.payload.exp).toBeWithin(
    Math.floor((Date.now() + 15 * 60 * 1000 - 5000) / 1000),
    Math.floor((Date.now() + 15 * 60 * 1000 + 5000) / 1000),
  );

  const refreshVerification = await jose.jwtVerify(result.refreshToken, publicKey);

  expect(refreshVerification.payload.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
});

test('it throws NOT_FOUND for a session that does not exist', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(client.verifySession({ id: 'does-not-exist' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it throws NOT_FOUND for a session that is already verified', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id, verified: true });
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(client.verifySession({ id: session.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
