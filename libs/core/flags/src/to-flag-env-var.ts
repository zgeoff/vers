import type { FlagKey } from './types';

export function toFlagEnvVar(key: FlagKey): string {
  return `FEATURE_${key.toUpperCase().replaceAll('-', '_')}`;
}
