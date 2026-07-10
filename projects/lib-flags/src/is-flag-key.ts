import { FLAGS } from './flags';
import type { FlagKey } from './types';

/** Narrows an arbitrary string to a registered {@link FlagKey}. */
export function isFlagKey(key: string): key is FlagKey {
  return Object.hasOwn(FLAGS, key);
}
