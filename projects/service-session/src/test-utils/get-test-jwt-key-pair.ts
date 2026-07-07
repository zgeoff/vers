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
  const keyPair = await jose.generateKeyPair('RS256', { extractable: true });

  const pemPair = await Promise.all([
    jose.exportPKCS8(keyPair.privateKey),
    jose.exportSPKI(keyPair.publicKey),
  ]);

  return { privateKeyPEM: pemPair[0], publicKeyPEM: pemPair[1] };
}

let cached: Promise<TestJWTKeyPair> | undefined;
