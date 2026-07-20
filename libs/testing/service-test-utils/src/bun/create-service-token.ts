import type { TokenIssuer } from '@vers/service-auth';
import { TOKEN_ALGORITHM } from '@vers/service-auth';
import type { CryptoKey } from 'jose';
import * as jose from 'jose';

interface CreateServiceTokenOptions {
  readonly actingSessionId?: string;
  readonly actingUserId?: string;
  readonly audience: string;
  readonly expiresIn?: string;
  readonly issuer?: TokenIssuer;
  readonly privateKey: CryptoKey;
}

/**
 * Signs a short-lived s2s token carrying the shared claim vocabulary, for tests to send as
 * `Authorization: Bearer <token>`. `issuer` defaults to the edge identity most suites act as; it
 * lands in both `iss` and the `kid` verification resolves the key by.
 */
export function createServiceToken(options: CreateServiceTokenOptions): Promise<string> {
  const issuer = options.issuer ?? 'app-web';

  const claims = {
    ...(options.actingUserId !== undefined && { sub: options.actingUserId }),
    ...(options.actingSessionId !== undefined && { sid: options.actingSessionId }),
  };

  const jwt = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: issuer })
    .setIssuer(issuer)
    .setAudience(options.audience)
    .setExpirationTime(options.expiresIn ?? '60s');

  return jwt.sign(options.privateKey);
}
