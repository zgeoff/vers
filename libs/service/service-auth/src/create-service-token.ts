import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { buildServiceAudience } from './build-service-audience';
import { TOKEN_ALGORITHM } from './token-claims';
import type { ServiceName, TokenIssuer } from './types';

export interface CreateServiceTokenOptions {
  readonly actingSessionID?: string;
  readonly actingUserID?: string;
  readonly audience: ServiceName;
  readonly expiresIn?: string;
  readonly issuer: TokenIssuer;
  readonly privateKey: CryptoKey;
}

export function createServiceToken(options: Readonly<CreateServiceTokenOptions>): Promise<string> {
  const claims = {
    ...(options.actingUserID !== undefined && { sub: options.actingUserID }),
    ...(options.actingSessionID !== undefined && { sid: options.actingSessionID }),
  };

  const jwt = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: options.issuer })
    .setIssuer(options.issuer)
    .setAudience(buildServiceAudience(options.audience))
    .setExpirationTime(options.expiresIn ?? '60s');

  return jwt.sign(options.privateKey);
}
