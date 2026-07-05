import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM, TOKEN_ISSUER } from '../token-claims';

/** Signs a short-lived s2s token carrying the shared claim vocabulary, for tests to send as `Authorization: Bearer <token>`. */
export async function createServiceToken(options: {
  actingUserId?: string;
  audience: string;
  expiresIn?: string;
  privateKey: CryptoKey;
}): Promise<string> {
  const jwt = new jose.SignJWT(
    options.actingUserId ? { sub: options.actingUserId } : {},
  )
    .setProtectedHeader({ alg: TOKEN_ALGORITHM })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(options.audience)
    .setExpirationTime(options.expiresIn ?? '60s');

  return jwt.sign(options.privateKey);
}
