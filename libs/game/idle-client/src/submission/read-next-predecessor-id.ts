import type { ActivityData } from '@vers/contract-activity';
import {
  LAST_STARTED_ACTIVITY_KEY,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function readNextPredecessorID(avatarID: string): Promise<null | string> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(
    [PENDING_ACTIVITY_STARTS_STORE_NAME, PREFERENCES_STORE_NAME],
    'readonly',
  );

  const [record, rows] = await Promise.all([
    tx.objectStore(PREFERENCES_STORE_NAME).get(`${LAST_STARTED_ACTIVITY_KEY}:${avatarID}`),
    tx.objectStore(PENDING_ACTIVITY_STARTS_STORE_NAME).getAll(),
    tx.done,
  ]);

  const lastStartedID =
    record !== undefined && 'lastActivityID' in record ? record.lastActivityID : null;

  // an outbox can hold a minted start that its last-started record never reached; the next start
  // follows it, or the two would name the same predecessor and fork the avatar's play order
  return pickChainTipID(
    rows.filter((row) => row.avatarID === avatarID),
    lastStartedID,
  );
}

function pickChainTipID(rows: ReadonlyArray<ActivityData>, fromID: null | string): null | string {
  const followed = new Set<string>();

  let tipID = fromID;
  let successor = pickLatestSuccessor(rows, tipID, followed);

  while (successor !== undefined) {
    followed.add(successor.id);

    tipID = successor.id;
    successor = pickLatestSuccessor(rows, tipID, followed);
  }

  return tipID;
}

function pickLatestSuccessor(
  rows: ReadonlyArray<ActivityData>,
  predecessorID: null | string,
  followed: ReadonlySet<string>,
): ActivityData | undefined {
  let latest: ActivityData | undefined;

  for (const row of rows) {
    if (
      row.predecessorActivityID === predecessorID &&
      !followed.has(row.id) &&
      (latest === undefined || row.createdAt.getTime() > latest.createdAt.getTime())
    ) {
      latest = row;
    }
  }

  return latest;
}
