import type { SigningKeySet } from '@vers/contract-session';
import * as jose from 'jose';
import { readTestSigningPrivateKey } from './read-test-signing-private-key';

let cached: Promise<{ keyID: string; keySet: SigningKeySet }> | undefined;

// the same dev key mints every test access token, so the published set is one EdDSA key whose id
// is its thumbprint, the way the real service publishes its RS256 key
export function buildTestSigningKeySet(): Promise<{ keyID: string; keySet: SigningKeySet }> {
  cached ??= buildPublishedTestKey();

  return cached;
}

async function buildPublishedTestKey(): Promise<{ keyID: string; keySet: SigningKeySet }> {
  const privateKey = await readTestSigningPrivateKey();
  const exported = await jose.exportJWK(privateKey);

  const publicJWK = { crv: String(exported.crv), kty: String(exported.kty), x: String(exported.x) };

  const keyID = await jose.calculateJwkThumbprint(publicJWK);

  return { keyID, keySet: { keys: [{ ...publicJWK, alg: 'EdDSA', kid: keyID, use: 'sig' }] } };
}
