import * as jose from 'jose';

interface TestJWTKeyPair {
  readonly privateKeyPEM: string;
  readonly publicKeyPEM: string;
}

/**
 * One RS256 keypair per test process: the preload publishes the private key as
 * `JWT_SIGNING_PRIVKEY`, and tests verify minted tokens against the public half. Bridges preload
 * and test setup through shared module state so both sides agree on the same keypair.
 */
export function getTestJWTKeyPair(): Promise<TestJWTKeyPair> {
  cached ??= createTestJWTKeyPair();

  return cached;
}

async function createTestJWTKeyPair(): Promise<TestJWTKeyPair> {
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256', { extractable: true });

  const [privateKeyPEM, publicKeyPEM] = await Promise.all([
    jose.exportPKCS8(privateKey),
    jose.exportSPKI(publicKey),
  ]);

  return { privateKeyPEM, publicKeyPEM };
}

let cached: Promise<TestJWTKeyPair> | undefined;
