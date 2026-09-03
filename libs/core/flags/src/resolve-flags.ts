import { FLAGS } from './flags';
import { getFlagClient } from './get-flag-client';
import type { FlagKey } from './types';

export async function resolveFlags(): Promise<Readonly<Record<FlagKey, boolean>>> {
  const client = getFlagClient();

  return {
    'game-renderer': await client.getBooleanValue(
      'game-renderer',
      FLAGS['game-renderer'].defaultValue,
    ),
    market: await client.getBooleanValue('market', FLAGS.market.defaultValue),
  };
}
