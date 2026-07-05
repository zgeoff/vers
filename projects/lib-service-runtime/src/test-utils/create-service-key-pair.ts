import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM } from '../token-claims';

/** Generates a fresh Ed25519 keypair for tests: the public key in the SPKI PEM shape services expect. */
export async function createServiceKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKeyPEM: string;
}> {
  const { privateKey, publicKey } = await jose.generateKeyPair(TOKEN_ALGORITHM, {
    extractable: true,
  });

  const publicKeyPEM = await jose.exportSPKI(publicKey);

  return { privateKey, publicKeyPEM };
}
