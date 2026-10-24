import { createDB } from '@vers/db';
import { readRetentionRefusals, updateExpiredSimVersions } from '@vers/sim-registry';
import { requireEnvVar } from '../utils/require-env-var';
import { applyRetentionActions } from './apply-retention-actions';
import { planRetentionActions } from './plan-retention-actions';
import { updateParkedActivities } from './update-parked-activities';

export async function runSweepReplay(): Promise<void> {
  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the replay retention sweep reads and writes the shared database',
  );

  const db = createDB({ databaseURL });

  const tombstoned = await updateExpiredSimVersions(db);

  const actions = planRetentionActions(tombstoned);

  await applyRetentionActions(actions);

  const unparked = await updateParkedActivities(db);
  const refusals = await readRetentionRefusals(db);

  await db.destroy();

  console.log(
    `sweep-replay: tombstoned ${tombstoned.length} sim version(s), destroyed ${actions.length} provider app(s), unparked ${unparked.length} activity(ies)`,
  );

  // an expired version still pinned by unverified work stays a replay target: the refusal fails the
  // run so the scheduled workflow alarms, and the sweep retries daily until the work settles
  for (const refusal of refusals) {
    console.error(
      `✗ sweep-replay — sim version ${refusal.engineHash} is past retention but ${refusal.unverifiedActivities} activity(ies) still pin unverified work to it; not pruned`,
    );
  }

  if (refusals.length > 0) {
    process.exitCode = 1;
  }
}
