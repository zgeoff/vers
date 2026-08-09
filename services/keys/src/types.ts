import type { Population, SecretRef } from '@vers/contract-keys';

/**
 * Payload shape for the `deriveAvatarKey` procedure's NOT_FOUND error.
 */
export interface UnknownKeyVersionPayload {
  readonly data: { readonly keyVersion: number; readonly population: Population };
}

/**
 * Payload shape for the `deriveScopeSecret` procedure's NOT_FOUND error.
 */
export interface UnknownScopeSecretVersionPayload {
  readonly data: { readonly secretRef: SecretRef; readonly secretVersion: number };
}
