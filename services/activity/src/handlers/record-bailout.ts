import type { Logger } from '@vers/service-runtime/logging';
import { recordAdvanceBailout } from '../metrics/record-advance-bailout';
import { recordRefusal } from '../metrics/record-refusal';
import type { BailOutcome } from './types';
import { writeRefusalLine } from './write-refusal-line';

const BAILOUT_REASONS = {
  capped: 'activity_capped',
  'chain-quarantined': 'chain_quarantined',
  'checkpoint-invalid': 'checkpoint_invalid',
  conflict: 'conflict',
  'session-evicted': 'session_evicted',
  terminal: 'terminal',
} as const;

export function recordBailout(logger: Logger, outcome: Readonly<BailOutcome>): void {
  recordAdvanceBailout(BAILOUT_REASONS[outcome.kind]);

  if (outcome.kind === 'checkpoint-invalid') {
    recordRefusal('CHECKPOINT_INVALID', outcome.reason);
    writeRefusalLine(logger, 'CHECKPOINT_INVALID', outcome.reason);
  }

  if (outcome.kind === 'conflict') {
    recordRefusal('CONFLICT', outcome.reason);
    writeRefusalLine(logger, 'CONFLICT', outcome.reason);
  }
}
