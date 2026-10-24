import type { ActivityData } from '@vers/contract-activity';
import { EncounterNodeSchema } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Selectable } from 'kysely';
import { isUniqueViolation } from '../is-unique-violation';
import { recordAdvanceContinuation } from '../metrics/record-advance-continuation';
import { buildBailError } from './build-bail-error';
import { ContinuationBailError } from './continuation-bail-error';
import { recordBailout } from './record-bailout';
import { resolveActivityStartRow } from './resolve-activity-start-row';
import { resolveMintIDCollision } from './resolve-mint-id-collision';
import { runContinuation } from './run-continuation';
import { toActivityData } from './to-activity-data';
import type {
  AdvanceActivityDeps,
  AdvanceActivityOpts,
  BailOutcome,
  MintedContinuation,
  PinnedActivityContext,
} from './types';

export async function advanceActivity(
  deps: AdvanceActivityDeps,
  opts: AdvanceActivityOpts,
): Promise<{ activity: ActivityData; appendedHead: number }> {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionID;

  const activityStartRow = await resolveActivityStartRow(deps, opts, actingUserID, actingSessionID);

  const pinned: PinnedActivityContext = {
    avatarId: activityStartRow.avatarId,
    contentVersion: activityStartRow.contentVersion,
    encounterNode: EncounterNodeSchema.parse(activityStartRow.encounterNode),
    keyVersion: activityStartRow.keyVersion,
    scopeId: activityStartRow.scopeId,
    scopeType: activityStartRow.scopeType,
    secretRef: activityStartRow.secretRef,
    secretVersion: activityStartRow.secretVersion,
    simVersion: activityStartRow.simVersion,
  };

  let targetActivityID = opts.input.activityID;
  let targetExpectedHead = opts.input.expectedHead;
  let finalRow: Selectable<Activities> = activityStartRow;

  for (const continuation of opts.input.continuations) {
    const stepActivityID = targetActivityID;
    const stepExpectedHead = targetExpectedHead;
    let minted: MintedContinuation;

    try {
      minted = await runContinuation(deps, pinned, {
        actingSessionID,
        continuation,
        targetActivityID: stepActivityID,
        targetExpectedHead: stepExpectedHead,
      });
    } catch (error: unknown) {
      if (error instanceof ContinuationBailError) {
        recordBailout(error.outcome);
        throw buildBailError(opts.errors, error.outcome);
      }

      if (!isUniqueViolation(error)) {
        throw error;
      }

      // The mint's insert lost to another row already minted at this client id — resolved here,
      // outside any transaction, since the one that just rolled back cannot run another
      // statement once a constraint violation has poisoned it.
      const recovered = await resolveMintIDCollision(deps.db, pinned, continuation);

      if (recovered.kind === 'refused') {
        const outcome: BailOutcome = {
          activityID: stepActivityID,
          appendedHead: stepExpectedHead,
          avatarID: pinned.avatarId,
          kind: 'conflict',
          reason: recovered.reason,
        };

        recordBailout(outcome);
        throw buildBailError(opts.errors, outcome);
      }

      minted = recovered.row;
    }

    recordAdvanceContinuation(minted.mintOutcome);

    deps.sendReplayWake();

    targetActivityID = minted.row.id;
    targetExpectedHead = 0;
    finalRow = minted.row;
  }

  return { activity: toActivityData(finalRow), appendedHead: finalRow.appendedHead };
}
