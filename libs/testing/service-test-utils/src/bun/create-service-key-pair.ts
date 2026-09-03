import { SERVICE_TOKEN_ISSUERS, TOKEN_ALGORITHM } from '@vers/service-auth';
import type { CryptoKey } from 'jose';
import * as jose from 'jose';

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
