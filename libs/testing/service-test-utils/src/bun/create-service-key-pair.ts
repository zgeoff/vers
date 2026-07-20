import { SERVICE_TOKEN_ISSUERS, TOKEN_ALGORITHM } from '@vers/service-auth';
import type { CryptoKey } from 'jose';
import * as jose from 'jose';

/**
 * Generates a fresh Ed25519 keypair for tests, its public half registered in a JWKS under every
 * minting issuer's `kid` — so the one private key mints valid tokens as any issuer a test claims.
 */
export async function createServiceKeyPair(): Promise<{
  jwksJSON: string;
  privateKey: CryptoKey;
}> {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, {
    extractable: true,
  });

  const publicJWK = await jose.exportJWK(keyPair.publicKey);

  const keys = SERVICE_TOKEN_ISSUERS.map((issuer) => {
    const key = structuredClone(publicJWK);

    key.kid = issuer;

    return key;
  });

  return { jwksJSON: JSON.stringify({ keys }), privateKey: keyPair.privateKey };
}
