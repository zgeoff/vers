import type { Population } from '@vers/contract-keys';

/**
 * Payload shape for the `deriveAvatarKey` procedure's NOT_FOUND error.
 */
export interface UnknownKeyVersionPayload {
  readonly data: { readonly keyVersion: number; readonly population: Population };
}
