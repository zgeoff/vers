import { expect, test } from 'bun:test';
import { toJSONWebKeySet } from '@vers/contract-session';
import * as jose from 'jose';
import invariant from 'tiny-invariant';
import { buildSigningKeySet } from './build-signing-key-set';

test('it publishes the active key first, id-ed by its thumbprint, with no private member', async () => {
  const keyPair = await jose.generateKeyPair('RS256', { extractable: true });
  const published = await buildSigningKeySet({ active: keyPair.privateKey, retired: [] });
  const publicJWK = await jose.exportJWK(keyPair.publicKey);
  const thumbprint = await jose.calculateJwkThumbprint(publicJWK);

  invariant(publicJWK.e !== undefined && publicJWK.n !== undefined, 'an RSA JWK carries e and n');

  expect(published).toStrictEqual({
    activeKeyID: thumbprint,
    keySet: {
      keys: [
        {
          alg: 'RS256',
          e: publicJWK.e,
          kid: thumbprint,
          kty: 'RSA',
          n: publicJWK.n,
          use: 'sig' as const,
        },
      ],
    },
  });
});

test('it publishes a retired key behind the active one so tokens minted before a rotation still verify', async () => {
  const active = await jose.generateKeyPair('RS256', { extractable: true });
  const retired = await jose.generateKeyPair('RS256', { extractable: true });

  const published = await buildSigningKeySet({
    active: active.privateKey,
    retired: [retired.publicKey],
  });

  const retiredJWK = await jose.exportJWK(retired.publicKey);
  const retiredThumbprint = await jose.calculateJwkThumbprint(retiredJWK);

  expect(published.keySet.keys.map((key) => key.kid)).toStrictEqual([
    published.activeKeyID,
    retiredThumbprint,
  ]);
});

test('it publishes keys a verifier accepts a signed token against', async () => {
  const keyPair = await jose.generateKeyPair('RS256', { extractable: true });
  const published = await buildSigningKeySet({ active: keyPair.privateKey, retired: [] });

  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: published.activeKeyID })
    .setSubject('user_1')
    .sign(keyPair.privateKey);

  const verified = await jose.jwtVerify(
    token,
    jose.createLocalJWKSet(toJSONWebKeySet(published.keySet)),
  );

  expect(verified.payload.sub).toBe('user_1');
});
