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

/**
 * Mints the s2s token every outbound service call carries. `issuer` is the minting service's own
 * identity: it becomes the `iss` claim and the protected header's `kid`, and the token only
 * verifies against the key registered for that issuer — sign with your own key, never another
 * minter's. `actingUserID` becomes the token's `sub` claim; omitting it mints a verified-anonymous
 * token instead. `actingSessionID` becomes the `sid` claim naming the caller's underlying session —
 * the writer identity activity appends are checked against; flows holding no live session omit it.
 */
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
