import type { CryptoKey } from 'jose';

/** Payload shape for an authed procedure's UNAUTHORIZED error when no acting user is present. */
export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

/** Payload shape for a data-less contract error (NOT_FOUND/CONFLICT/SESSION_EXPIRED/...). */
export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

/** Signing dependencies every token-minting handler closes over. */
export interface SessionSigningDeps {
  readonly apiIdentifier: string;
  readonly signingKey: CryptoKey;
}
