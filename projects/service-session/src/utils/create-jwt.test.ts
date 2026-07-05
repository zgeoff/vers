import * as jose from 'jose';
import { expect, test } from 'vitest';
import { env } from '../env';
import { createJWT } from './create-jwt';

test('it creates a valid JWT with correct claims', async () => {
  const data = {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    userID: 'user-123',
  };

  const jwt = await createJWT(data);

  const publicKey = await jose.importSPKI(env.JWT_SIGNING_PUBKEY, 'RS256');

  const { payload, protectedHeader } = await jose.jwtVerify(jwt, publicKey, {
    audience: env.API_IDENTIFIER,
    issuer: env.API_IDENTIFIER,
  });

  expect(protectedHeader).toStrictEqual({
    alg: 'RS256',
  });

  const expiresAtSeconds = data.expiresAt.getTime().toString().slice(0, 10);

  expect(payload).toStrictEqual({
    aud: env.API_IDENTIFIER,
    exp: Math.trunc(Number(expiresAtSeconds)),
    iat: expect.any(Number),
    iss: env.API_IDENTIFIER,
    sub: data.userID,
  });
});
