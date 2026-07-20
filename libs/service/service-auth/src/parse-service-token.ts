import * as jose from 'jose';
import { isTokenIssuer } from './is-token-issuer';
import type { ServiceKeySet } from './parse-service-jwks';
import { TOKEN_ALGORITHM } from './token-claims';
import type { TokenIssuer } from './types';

export type ServiceTokenResolution =
  | { actingSessionId: null | string; actingUserId: null | string; issuer: TokenIssuer }
  | { failure: 'invalid-service-token' };

interface ParseServiceTokenOptions {
  readonly audience: string;
  readonly keySet: ServiceKeySet;
}

/**
 * Verifies the s2s token on a request and resolves the issuer that minted it plus the acting user
 * it names. The token travels as `Authorization: Bearer <jwt>`; before any signature check, the
 * claimed `iss` must be a known minting identity and must equal the header's `kid`, so the key set
 * only ever offers the key registered for that issuer — a signature by any other minter's key
 * cannot validate. A missing header, malformed header, bad signature, unknown or mismatched
 * `iss`/`kid`, wrong `aud`, or expired token all resolve to the same `invalid-service-token`
 * failure — none of these are a caller's problem to fix, so no detail beyond the failure itself is
 * surfaced.
 */
export async function parseServiceToken(
  request: Request,
  options: Readonly<ParseServiceTokenOptions>,
): Promise<ServiceTokenResolution> {
  const authorization = request.headers.get('authorization');

  if (authorization === null || !authorization.startsWith('Bearer ')) {
    return { failure: 'invalid-service-token' };
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const header = jose.decodeProtectedHeader(token);
    const issuer = jose.decodeJwt(token).iss;

    if (!isTokenIssuer(issuer) || header.kid !== issuer) {
      return { failure: 'invalid-service-token' };
    }

    const verification = await jose.jwtVerify(token, options.keySet, {
      algorithms: [TOKEN_ALGORITHM],
      audience: options.audience,
      issuer,
    });

    return {
      actingSessionId:
        typeof verification.payload['sid'] === 'string' ? verification.payload['sid'] : null,
      actingUserId: typeof verification.payload.sub === 'string' ? verification.payload.sub : null,
      issuer,
    };
  } catch {
    return { failure: 'invalid-service-token' };
  }
}
