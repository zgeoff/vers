import { match } from 'ts-pattern';
import type { AdvanceActivityOpts, BailOutcome } from './types';

export function buildBailError(
  errors: AdvanceActivityOpts['errors'],
  outcome: Readonly<BailOutcome>,
): Error {
  return match(outcome)
    .with({ kind: 'chain-quarantined' }, (quarantined) =>
      errors.CHAIN_QUARANTINED({
        data: { activityID: quarantined.activityID, appendedHead: quarantined.appendedHead },
      }),
    )
    .with({ kind: 'capped' }, (capped) =>
      errors.ACTIVITY_CAPPED({
        data: { activityID: capped.activityID, appendedHead: capped.appendedHead },
      }),
    )
    .with({ kind: 'checkpoint-invalid' }, (invalid) =>
      errors.CHECKPOINT_INVALID({
        data: {
          activityID: invalid.activityID,
          appendedHead: invalid.appendedHead,
          avatarID: invalid.avatarID,
          reason: invalid.reason,
        },
      }),
    )
    .with({ kind: 'conflict' }, (conflict) =>
      errors.CONFLICT({
        data: {
          activityID: conflict.activityID,
          appendedHead: conflict.appendedHead,
          avatarID: conflict.avatarID,
          reason: conflict.reason,
        },
      }),
    )
    .with({ kind: 'session-evicted' }, (evicted) =>
      errors.SESSION_EVICTED({
        data: { activityID: evicted.activityID, appendedHead: evicted.appendedHead },
      }),
    )
    .with({ kind: 'terminal' }, (terminal) =>
      errors.ACTIVITY_TERMINAL({
        data: {
          activityID: terminal.activityID,
          appendedHead: terminal.appendedHead,
          status: terminal.status,
        },
      }),
    )
    .exhaustive();
}
