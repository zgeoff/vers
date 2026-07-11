import { FLAGS } from './flags';
import { getFlagClient } from './get-flag-client';
import type { FlagKey } from './types';

/**
 * Evaluates every registered flag server-side. This is the SSR pass-through payload: callers
 * cross the resolved booleans to the client rather than shipping the evaluation machinery itself.
 * The literal return keeps the record total over the registry — adding a flag fails typecheck
 * here until its resolution line exists.
 */
export async function resolveFlags(): Promise<Readonly<Record<FlagKey, boolean>>> {
  const client = getFlagClient();

  return {
    market: await client.getBooleanValue('market', FLAGS.market.defaultValue),
  };
}
