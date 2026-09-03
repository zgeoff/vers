import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM } from './token-claims';

export function parseServicePrivateKey(pkcs8: string): Promise<CryptoKey> {
  return jose.importPKCS8(pkcs8, TOKEN_ALGORITHM);
}
