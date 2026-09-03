import type { Population, SecretRef } from '@vers/contract-keys';

export interface UnknownKeyVersionPayload {
  readonly data: { readonly keyVersion: number; readonly population: Population };
}

export interface UnknownScopeSecretVersionPayload {
  readonly data: { readonly secretRef: SecretRef; readonly secretVersion: number };
}
