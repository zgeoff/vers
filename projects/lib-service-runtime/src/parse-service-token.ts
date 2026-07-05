import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM, TOKEN_ISSUER } from './token-claims';

export type ServiceTokenResolution =
  | { actingUserId: null | string }
  | { failure: 'invalid-service-token' };

/**
 * Verifies the s2s token on a request and resolves the acting user it names. The token travels as
 * `Authorization: Bearer <jwt>`; a missing header, malformed header, bad signature, wrong
 * `iss`/`aud`, or expired token all resolve to the same `invalid-service-token` failure — none of
 * these are a caller's problem to fix, so no detail beyond the failure itself is surfaced.
 */
export async function parseServiceToken(
  request: Request,
  options: { audience: string; publicKey: CryptoKey },
): Promise<ServiceTokenResolution> {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return { failure: 'invalid-service-token' };
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const { payload } = await jose.jwtVerify(token, options.publicKey, {
      algorithms: [TOKEN_ALGORITHM],
      audience: options.audience,
      issuer: TOKEN_ISSUER,
    });

    return {
      actingUserId: typeof payload.sub === 'string' ? payload.sub : null,
    };
  } catch {
    return { failure: 'invalid-service-token' };
  }
}
