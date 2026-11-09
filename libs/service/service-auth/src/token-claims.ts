import type { TokenIssuer, TokenScope } from './types';

export const SERVICE_TOKEN_ISSUERS = [
  'app-web',
  'service-activity',
  'service-replay',
] as const satisfies ReadonlyArray<TokenIssuer>;

export const SERVICE_TOKEN_SCOPES = ['qa:seed'] as const satisfies ReadonlyArray<TokenScope>;
export const TOKEN_ALGORITHM = 'EdDSA';
