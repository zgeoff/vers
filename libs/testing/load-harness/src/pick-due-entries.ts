import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from '@vers/contract-activity';

export function pickDueEntries(
  entries: ReadonlyArray<CheckpointBatchEntry>,
  sent: number,
  elapsedMs: number,
): Array<CheckpointBatchEntry> {
  const due: Array<CheckpointBatchEntry> = [];

  for (const entry of entries.slice(sent, sent + MAX_CATCH_UP_BATCH_CHECKPOINTS)) {
    if (entry.payload.time > elapsedMs) {
      break;
    }

    due.push(entry);
  }

  return due;
}
