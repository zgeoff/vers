import { expect, mock, onTestFinished, test } from 'bun:test';
import type { SessionContract } from '@vers/contract-session';
import { toJSONWebKeySet } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, resolveTestJWTKeyPair, waitFor } from '@vers/test-utils';
import * as jose from 'jose';
import invariant from 'tiny-invariant';
import { createSessionService } from './create-session-service';
import { createSessionRow } from './test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();

  onTestFinished(() => db[Symbol.asyncDispose]());

  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db };
}

test('it wires an injected db into the router instead of building one from env', async () => {
  const ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await client.createSession({ ipAddress: '127.0.0.1', userID: created.user.id });

  const rows = await ctx.db.selectFrom('sessions').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createSessionService();

  onTestFinished(() => service.stop());

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it stops serving, destroys the db it built and exits 0 on SIGTERM', async () => {
  const exit = mock((_code: number) => {});

  const service = await createSessionService();

  onTestFinished(() => service.stop());

  service.serve({ exit, port: 0 });
  process.emit('SIGTERM');

  await waitFor(() => {
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  expect(service.resources.db.selectFrom('sessions').select('id').execute()).rejects.toThrow();
});

test('it publishes the signing key as one RS256 signature key whose id is its thumbprint', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const published = await client.getSigningKeys({});
  const keyPair = await resolveTestJWTKeyPair();
  const publicKey = await jose.importSPKI(keyPair.publicKeyPEM, 'RS256');
  const publicJWK = await jose.exportJWK(publicKey);
  const thumbprint = await jose.calculateJwkThumbprint(publicJWK);

  invariant(publicJWK.e !== undefined && publicJWK.n !== undefined, 'an RSA JWK carries e and n');

  expect(published).toStrictEqual({
    keys: [
      {
        alg: 'RS256',
        // oxlint-disable-next-line id-length -- RFC 7518 names the RSA key's exponent and modulus `e` and `n`
        e: publicJWK.e,
        kid: thumbprint,
        kty: 'RSA',
        // oxlint-disable-next-line id-length -- RFC 7518 names the RSA key's exponent and modulus `e` and `n`
        n: publicJWK.n,
        use: 'sig' as const,
      },
    ],
  });
});

test('it mints access tokens that verify against the published key set by key id', async () => {
  const ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const session = await createSessionRow(ctx.db, { userId: created.user.id, verified: false });
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const tokens = await client.verifySession({ id: session.id });
  const published = await client.getSigningKeys({});

  const header = jose.decodeProtectedHeader(tokens.accessToken);

  const verified = await jose.jwtVerify(
    tokens.accessToken,
    jose.createLocalJWKSet(toJSONWebKeySet(published)),
  );

  expect(header.kid).toBe(published.keys[0]?.kid);
  expect(verified.payload.sub).toBe(created.user.id);
});

test('it accepts a call from app-web', async () => {
  const ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session', issuer: 'app-web' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await expect(
    client.createSession({ ipAddress: '127.0.0.1', userID: created.user.id }),
  ).toResolve();
});

test('it rejects a call from service-activity with 403', async () => {
  const ctx = await setupTest();

  const viewer = await createAnonymousViewer({
    audience: 'service-session',
    issuer: 'service-activity',
  });

  const response = await ctx.app.handle(
    new Request('http://test.local/rpc/createSession', {
      headers: { authorization: `Bearer ${viewer.token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);
});
