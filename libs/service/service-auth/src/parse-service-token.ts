import * as jose from 'jose';
import { isTokenIssuer } from './is-token-issuer';
import type { ServiceKeySet } from './parse-service-jwks';
import { TOKEN_ALGORITHM } from './token-claims';
import type { TokenIssuer } from './types';

export type ServiceTokenResolution =
  | { actingSessionID: null | string; actingUserID: null | string; issuer: TokenIssuer }
  | { failure: 'invalid-service-token' };

interface ParseServiceTokenOptions {
  readonly audience: string;
  readonly keySet: ServiceKeySet;
}

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
      actingSessionID:
        typeof verification.payload['sid'] === 'string' ? verification.payload['sid'] : null,
      actingUserID: typeof verification.payload.sub === 'string' ? verification.payload.sub : null,
      issuer,
    };
  } catch {
    return { failure: 'invalid-service-token' };
  }
}
