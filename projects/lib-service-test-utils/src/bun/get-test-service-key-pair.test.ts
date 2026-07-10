import { expect, test } from 'bun:test';
import { TOKEN_ALGORITHM } from '@vers/service-runtime';
import * as jose from 'jose';
import { createServiceToken } from './create-service-token';
import { getTestServiceKeyPair } from './get-test-service-key-pair';

test('it memoizes the same keypair across repeated calls within a process', async () => {
  const first = await getTestServiceKeyPair();
  const second = await getTestServiceKeyPair();

  expect(second.privateKey).toBe(first.privateKey);
  expect(second.publicKeyPEM).toBe(first.publicKeyPEM);
});

test('it returns a public PEM that verifies tokens signed with the private key', async () => {
  const keyPair = await getTestServiceKeyPair();

  const token = await createServiceToken({
    audience: 'get-test-service-key-pair-spec',
    privateKey: keyPair.privateKey,
  });

  const publicKey = await jose.importSPKI(keyPair.publicKeyPEM, TOKEN_ALGORITHM);

  await expect(
    jose.jwtVerify(token, publicKey, { audience: 'get-test-service-key-pair-spec' }),
  ).toResolve();
});
