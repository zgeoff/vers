import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM, TOKEN_ISSUER } from '../token-claims';

interface CreateServiceTokenOptions {
  actingUserId?: string;
  audience: string;
  expiresIn?: string;
  privateKey: CryptoKey;
}

/** Signs a short-lived s2s token carrying the shared claim vocabulary, for tests to send as `Authorization: Bearer <token>`. */
export function createServiceToken(options: CreateServiceTokenOptions): Promise<string> {
  const claims = options.actingUserId ? { sub: options.actingUserId } : {};
  const jwt = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: TOKEN_ALGORITHM })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(options.audience)
    .setExpirationTime(options.expiresIn ?? '60s');

  return jwt.sign(options.privateKey);
}
