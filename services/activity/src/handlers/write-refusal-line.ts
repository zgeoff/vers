import type { Logger } from '@vers/service-runtime/logging';
import type { RefusalCode, RefusalReason } from '../metrics/record-refusal';

// The infra program's refusal alarm matches the prefix of this line and groups by the whole line, so
// the reason stays in the message text: a reworded prefix lets a stuck device go unalarmed.
export function writeRefusalLine(logger: Logger, code: RefusalCode, reason: RefusalReason): void {
  logger.warn(`activity write refused: ${code} ${reason}`, { code, reason });
}
