import * as jose from 'jose';

let privateKeyPromise: Promise<jose.CryptoKey> | undefined;

export function readTestSigningPrivateKey(): Promise<jose.CryptoKey> {
  privateKeyPromise ??= jose.importPKCS8(readDevPrivateKeyPEM(), 'EdDSA', { extractable: true });

  return privateKeyPromise;
}

function readDevPrivateKeyPEM(): string {
  const key = process.env['SERVICE_AUTH_PRIVATE_KEY'];

  if (key === undefined) {
    throw new Error('$SERVICE_AUTH_PRIVATE_KEY is required');
  }

  return key;
}
