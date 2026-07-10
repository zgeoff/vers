import { TOKEN_ALGORITHM } from '@vers/service-auth';
import type { CryptoKey } from 'jose';
import * as jose from 'jose';

/**
 * Generates a fresh Ed25519 keypair for tests: the public key in the SPKI PEM shape services expect.
 */
export async function createServiceKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKeyPEM: string;
}> {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, {
    extractable: true,
  });

  const publicKeyPEM = await jose.exportSPKI(keyPair.publicKey);

  return { privateKey: keyPair.privateKey, publicKeyPEM };
}
