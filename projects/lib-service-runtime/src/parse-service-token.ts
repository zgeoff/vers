import type { CryptoKey } from 'jose';
import * as jose from 'jose';
import { TOKEN_ALGORITHM, TOKEN_ISSUER } from './token-claims';

export type ServiceTokenResolution =
  | { actingUserId: null | string }
  | { failure: 'invalid-service-token' };

interface ParseServiceTokenOptions {
  audience: string;
  publicKey: CryptoKey;
}

/**
 * Verifies the s2s token on a request and resolves the acting user it names. The token travels as
 * `Authorization: Bearer <jwt>`; a missing header, malformed header, bad signature, wrong
 * `iss`/`aud`, or expired token all resolve to the same `invalid-service-token` failure — none of
 * these are a caller's problem to fix, so no detail beyond the failure itself is surfaced.
 */
export async function parseServiceToken(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  request: Request,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  options: ParseServiceTokenOptions,
): Promise<ServiceTokenResolution> {
  const authorization = request.headers.get('authorization');

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
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
