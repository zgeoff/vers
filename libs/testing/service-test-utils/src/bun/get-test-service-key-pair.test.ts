import { expect, test } from 'bun:test';
import { parseServiceJWKS } from '@vers/service-auth';
import * as jose from 'jose';
import { createServiceToken } from './create-service-token';
import { getTestServiceKeyPair } from './get-test-service-key-pair';

test('it memoizes the same keypair across repeated calls within a process', async () => {
  const first = await getTestServiceKeyPair();
  const second = await getTestServiceKeyPair();

  expect(second.privateKey).toBe(first.privateKey);
  expect(second.jwksJSON).toBe(first.jwksJSON);
});

test('it returns a JWKS that verifies tokens signed with the private key as any issuer', async () => {
  const keyPair = await getTestServiceKeyPair();

  const keySet = parseServiceJWKS(keyPair.jwksJSON);

  const webToken = await createServiceToken({
    audience: 'get-test-service-key-pair-spec',
    issuer: 'app-web',
    privateKey: keyPair.privateKey,
  });

  const activityToken = await createServiceToken({
    audience: 'get-test-service-key-pair-spec',
    issuer: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  await expect(
    jose.jwtVerify(webToken, keySet, { audience: 'get-test-service-key-pair-spec' }),
  ).toResolve();

  await expect(
    jose.jwtVerify(activityToken, keySet, { audience: 'get-test-service-key-pair-spec' }),
  ).toResolve();
});
