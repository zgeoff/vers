import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { createJWT } from './create-jwt';

test('it names the signing key in the token header', async () => {
  const keyPair = await jose.generateKeyPair('RS256');

  const token = await createJWT({
    apiIdentifier: 'vers-test',
    expiresAt: new Date(Date.now() + 60_000),
    keyID: 'key-thumbprint',
    signingKey: keyPair.privateKey,
    userID: 'user_1',
  });

  expect(jose.decodeProtectedHeader(token)).toStrictEqual({ alg: 'RS256', kid: 'key-thumbprint' });
});
