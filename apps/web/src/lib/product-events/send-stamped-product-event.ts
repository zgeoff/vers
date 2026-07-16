import type { StampedProductEvent } from '@vers/product-analytics';
import { makeProductEventSender } from '@vers/product-analytics';
import { env } from '../../server/env';
import { logger } from '../../server/logger';

/**
 * The process-wide sender, built once from env; `null` when either Tinybird key is absent, which
 * makes delivery a no-op.
 */
const sender =
  env.TINYBIRD_URL !== undefined && env.TINYBIRD_INGEST_TOKEN !== undefined
    ? makeProductEventSender({ token: env.TINYBIRD_INGEST_TOKEN, url: env.TINYBIRD_URL })
    : null;

/**
 * Delivers one stamped product event to Tinybird. Best-effort: an undelivered event is logged and
 * dropped, never retried and never thrown — analytics loss is acceptable, analytics failing a
 * caller is not.
 */
export async function sendStampedProductEvent(event: StampedProductEvent): Promise<void> {
  if (sender === null) {
    return;
  }

  const delivered = await sender(event);

  if (!delivered) {
    logger.warn({ eventName: event.name }, 'product event delivery failed');
  }
}
