import type { TokenIssuer } from './types';

export const SERVICE_TOKEN_ISSUERS = [
  'app-web',
  'service-activity',
  'service-replay',
] as const satisfies ReadonlyArray<TokenIssuer>;

export const TOKEN_ALGORITHM = 'EdDSA';
