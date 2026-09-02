import * as jose from 'jose';

interface TestJWTKeyPair {
  readonly privateKeyPEM: string;
  readonly publicKeyPEM: string;
}

let cached: Promise<TestJWTKeyPair> | undefined;

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
