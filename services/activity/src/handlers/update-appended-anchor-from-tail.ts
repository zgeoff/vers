import { CheckpointPayloadSchema } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface UpdateAppendedAnchorFromTailActivity {
  readonly activityId: string;
  readonly appendedHead: number;
  readonly avatarId: string;
  readonly scopeId: string;
  readonly scopeType: string;
  readonly startChainIndex: number;
}

export async function updateAppendedAnchorFromTail(
  trx: Kysely<DB>,
  activity: Readonly<UpdateAppendedAnchorFromTailActivity>,
): Promise<void> {
  if (activity.appendedHead === 0) {
    return;
  }

  const tail = await trx
    .selectFrom('activityCheckpoints')
    .select('payload')
    .where('activityId', '=', activity.activityId)
    .where('version', '=', activity.appendedHead)
    .executeTakeFirst();

  if (tail === undefined) {
    return;
  }

  const payload = CheckpointPayloadSchema.parse(tail.payload);

  if (payload.type === 'started') {
    return;
  }

  await trx
    .updateTable('activityChains')
    .set({ appendedChainIndex: payload.chainIndex, appendedNextSeed: payload.nextSeed })
    .where('avatarId', '=', activity.avatarId)
    .where('scopeType', '=', activity.scopeType)
    .where('scopeId', '=', activity.scopeId)
    .where('appendedChainIndex', '=', activity.startChainIndex)
    .execute();
}
