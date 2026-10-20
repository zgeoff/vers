import { createDB } from '@vers/db';
import { readSimVersion } from '@vers/sim-registry';
import type { SimVersionRow } from '@vers/sim-registry';
import { requireEnvVar } from '../utils/require-env-var';

export async function readSimVersionRow(engineHash: string): Promise<SimVersionRow | undefined> {
  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the sim-version reconcile reads the sim_versions registry',
  );

  const db = createDB({ databaseURL });

  const row = await readSimVersion(db, engineHash);

  await db.destroy();

  return row;
}
