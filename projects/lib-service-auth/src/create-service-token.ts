import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { buildServiceAudience } from './build-service-audience';
import { TOKEN_ALGORITHM, TOKEN_ISSUER } from './token-claims';
import type { ServiceName } from './types';

export interface CreateServiceTokenOptions {
  readonly actingUserId?: string;
  readonly audience: ServiceName;
  readonly expiresIn?: string;
  readonly privateKey: CryptoKey;
}

/**
 * Mints the s2s token every outbound service call carries. `actingUserId` becomes the token's
 * `sub` claim; omitting it mints a verified-anonymous token instead.
 */
export function createServiceToken(options: Readonly<CreateServiceTokenOptions>): Promise<string> {
  const claims = options.actingUserId === undefined ? {} : { sub: options.actingUserId };

  const jwt = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: TOKEN_ALGORITHM })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(buildServiceAudience(options.audience))
    .setExpirationTime(options.expiresIn ?? '60s');

  return jwt.sign(options.privateKey);
}
