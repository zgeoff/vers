import type { FlagDefinition } from './types';

/**
 * The complete set of feature flags, keyed by flag name. Boolean-only by design: no percentage
 * rollouts, no variants, no targeting rules — a flag is either on or off for every caller.
 */
export const FLAGS = {
  market: { defaultValue: false, description: 'Market screen and its listings' },
} as const satisfies Readonly<Record<string, FlagDefinition>>;
