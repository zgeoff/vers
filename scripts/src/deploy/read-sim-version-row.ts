import { createDB } from '@vers/db';
import { findSimVersion } from '@vers/sim-registry';
import type { SimVersionRow } from '@vers/sim-registry';
import { requireEnvVar } from '../utils/require-env-var';

/**
 * Looks up the current `sim_versions` row for this engine hash — undefined
 * when this hash has never been provisioned.
 */
export async function readSimVersionRow(engineHash: string): Promise<SimVersionRow | undefined> {
  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the sim-version reconcile reads the sim_versions registry',
  );

  const db = createDB({ databaseURL });

  const row = await findSimVersion(db, engineHash);

  await db.destroy();

  return row;
}
