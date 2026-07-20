import type { TokenIssuer } from './types';

/**
 * Every identity allowed to mint s2s tokens. A token's `iss` names which of these signed it, and
 * verification resolves the key registered for that issuer alone — so holding one minting key
 * lets a caller impersonate only itself, never another minter.
 */
export const SERVICE_TOKEN_ISSUERS = [
  'app-web',
  'service-activity',
  'service-replay',
] as const satisfies ReadonlyArray<TokenIssuer>;

/**
 * Asymmetric algorithm service tokens are signed with.
 */
export const TOKEN_ALGORITHM = 'EdDSA';
