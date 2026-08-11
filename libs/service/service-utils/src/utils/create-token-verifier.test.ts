import { expect, test } from 'bun:test';
import { createTestJWT, getTestJWTKeyPair } from '@vers/test-utils';
import * as jose from 'jose';
import { createTokenVerifier } from './create-token-verifier';

test('it authorizes a valid token and extracts the payload', async () => {
  const keyPair = await getTestJWTKeyPair();

  const verifyToken = createTokenVerifier({
    audience: 'test.com',
    issuer: 'https://test.com/',
    spkiKey: keyPair.publicKeyPEM,
  });

  const signingKey = await jose.importPKCS8(keyPair.privateKeyPEM, 'RS256');

  const token = await createTestJWT({
    audience: 'test.com',
    issuer: 'https://test.com/',
    pkcs8Key: signingKey,
    sub: 'test_id',
  });

  const payload = await verifyToken(token);

  expect(payload).toStrictEqual({ iss: 'https://test.com/', sub: 'test_id' });
});

test('it rejects a missing token', async () => {
  const keyPair = await getTestJWTKeyPair();

  const verifyToken = createTokenVerifier({
    audience: 'test.com',
    issuer: 'https://test.com/',
    spkiKey: keyPair.publicKeyPEM,
  });

  expect(verifyToken('')).rejects.toThrow('Invalid Compact JWS');
});

test('it rejects an invalid token', async () => {
  const keyPair = await getTestJWTKeyPair();

  const verifyToken = createTokenVerifier({
    audience: 'test.com',
    issuer: 'https://test.com/',
    spkiKey: keyPair.publicKeyPEM,
  });

  expect(verifyToken('abc123')).rejects.toThrow('Invalid Compact JWS');
});
