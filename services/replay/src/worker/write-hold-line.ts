import type { Logger } from '@vers/service-runtime/logging';
import { match } from 'ts-pattern';
import type { ParkReason, ReplayIterationOutcome } from './types';

// The infra program's replay alarms match these lines, so a reworded message parks or quarantines
// an activity without alarming anyone. Write them only once the hold has committed, or a rolled-back
// iteration raises an alarm for a hold that never happened.
export function writeHoldLine(logger: Logger, outcome: Readonly<ReplayIterationOutcome>): void {
  match(outcome)
    .with({ kind: 'parked' }, (parked) => {
      logger.warn(pickParkMessage(parked.reason), {
        ...parked.parked,
        checkpointCount: parked.parked.appendedHead,
        reason: parked.reason,
      });
    })
    .with({ kind: 'quarantined' }, (quarantined) => {
      logger.error('replay attempts exhausted; activity quarantined', {
        activityID: quarantined.activityID,
      });
    })
    .with(
      { kind: 'backedOff' },
      { kind: 'idle' },
      { kind: 'matched' },
      { kind: 'rejected' },
      { kind: 'unconfirmedDivergence' },
      () => {},
    )
    .exhaustive();
}

function pickParkMessage(reason: ParkReason): string {
  if (reason === 'expired') {
    return 'sim version retention expired; parking activity for operator resolution';
  }

  if (reason === 'unknownVersion') {
    return 'sim version unrecognized; parking activity';
  }

  return 'replay duration cap exhausted before the expected checkpoint count; parking activity for operator resolution';
}
