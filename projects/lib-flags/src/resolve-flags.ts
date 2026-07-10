import { FLAGS } from './flags';
import { getFlagClient } from './get-flag-client';
import { isFlagKey } from './is-flag-key';
import type { FlagKey } from './types';

/**
 * Evaluates every registered flag server-side. This is the SSR pass-through payload: callers
 * cross the resolved booleans to the client rather than shipping the evaluation machinery itself.
 */
export async function resolveFlags(): Promise<Readonly<Record<FlagKey, boolean>>> {
  const client = getFlagClient();

  const keys = Object.keys(FLAGS).filter((key) => isFlagKey(key));

  const entries = await Promise.all(
    keys.map(
      async (key) => [key, await client.getBooleanValue(key, FLAGS[key].defaultValue)] as const,
    ),
  );

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries always returns a string-indexed record; entries covers exactly the FlagKeys built above
  return Object.fromEntries(entries) as Record<FlagKey, boolean>;
}
