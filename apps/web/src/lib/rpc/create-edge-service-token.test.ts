import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { createEdgeServiceToken } from './create-edge-service-token';

test('it mints a token carrying the acting user as its subject', async () => {
  const token = await createEdgeServiceToken({ actingUserID: 'user-1', audience: 'user' });

  const decoded = jose.decodeProtectedHeader(token);
  const payload = jose.decodeJwt(token);

  expect(decoded).toStrictEqual({ alg: 'EdDSA', kid: 'app-web' });
  expect(payload).toMatchObject({ aud: 'service-user', iss: 'app-web', sub: 'user-1' });
  expect(payload.exp).toBeNumber();
});

test('it mints a subject-less token for an anonymous actor', async () => {
  const token = await createEdgeServiceToken({ actingUserID: null, audience: 'session' });

  const payload = jose.decodeJwt(token);

  expect(payload.sub).toBeUndefined();
  expect(payload).toMatchObject({ aud: 'service-session', iss: 'app-web' });
});

test('it signs with a key the matching public key can verify', async () => {
  const publicKey = await jose.importSPKI(
    '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAlYDT10lOexhEJ46sO8T0AYm3z1x7sBEMOb3oljfh0WU=\n-----END PUBLIC KEY-----',
    'EdDSA',
  );

  const token = await createEdgeServiceToken({ actingUserID: 'user-1', audience: 'user' });

  await expect(jose.jwtVerify(token, publicKey)).toResolve();
});
