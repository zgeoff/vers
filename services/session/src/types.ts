import type { CryptoKey } from 'jose';

export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

export interface SessionSigningDeps {
  readonly apiIdentifier: string;
  readonly signingKey: CryptoKey;
}
