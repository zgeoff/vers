import { SERVICE_TOKEN_ISSUERS } from './token-claims';
import type { TokenIssuer } from './types';

/**
 * Narrows an untrusted `iss` claim to the closed set of minting identities.
 */
export function isTokenIssuer(value: unknown): value is TokenIssuer {
  return SERVICE_TOKEN_ISSUERS.some((issuer) => issuer === value);
}
