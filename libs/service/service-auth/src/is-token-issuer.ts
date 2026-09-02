import { SERVICE_TOKEN_ISSUERS } from './token-claims';
import type { TokenIssuer } from './types';

export function isTokenIssuer(value: unknown): value is TokenIssuer {
  return SERVICE_TOKEN_ISSUERS.some((issuer) => issuer === value);
}
