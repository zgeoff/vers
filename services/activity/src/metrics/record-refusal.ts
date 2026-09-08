import { metrics } from '@opentelemetry/api';
import type { AdvanceCheckpointInvalidReason, ConflictReason } from '@vers/contract-activity';

export type RefusalCode = 'CHECKPOINT_INVALID' | 'CONFLICT';

export type RefusalReason = AdvanceCheckpointInvalidReason | ConflictReason;

export function recordRefusal(code: RefusalCode, reason: RefusalReason): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.refusal', {
      description:
        'checkpoint and start refusals answered CHECKPOINT_INVALID or CONFLICT, by reason',
      unit: '{refusal}',
    });

  counter.add(1, { code, reason });
}
