import type { StampedProductEvent } from '@vers/product-analytics';
import { makeProductEventSender } from '@vers/product-analytics';
import { env } from '../../server/env';
import { logger } from '../../server/logger';

const sender =
  env.TINYBIRD_URL !== undefined && env.TINYBIRD_INGEST_TOKEN !== undefined
    ? makeProductEventSender({ token: env.TINYBIRD_INGEST_TOKEN, url: env.TINYBIRD_URL })
    : null;

export async function sendStampedProductEvent(event: StampedProductEvent): Promise<void> {
  if (sender === null) {
    return;
  }

  const delivered = await sender(event);

  if (!delivered) {
    logger.warn({ eventName: event.name }, 'product event delivery failed');
  }
}
