import type { OPReference } from './types';

export function formatOPReference(reference: OPReference): string {
  return `op://${reference.vault}/${reference.item}/${reference.field}`;
}
