import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM } from './token-claims';

/** Imports an edge signing key from its PKCS8 PEM, bound to the algorithm service tokens use. */
export function parseServicePrivateKey(pkcs8: string): Promise<CryptoKey> {
  return jose.importPKCS8(pkcs8, TOKEN_ALGORITHM);
}
