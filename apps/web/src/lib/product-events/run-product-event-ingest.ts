import type { ProductEvent } from '@vers/product-analytics';
import { loadSessionActor } from '../rpc/load-session-actor';
import { sendStampedProductEvent } from './send-stamped-product-event';

export async function runProductEventIngest(event: ProductEvent): Promise<void> {
  // arrival time, captured before session resolution so stage ordering never reflects
  // session-service latency
  const timestamp = new Date();

  const actor = await loadSessionActor();

  if (actor.kind !== 'actor') {
    return;
  }

  await sendStampedProductEvent({
    ...event,
    sessionID: actor.sessionID,
    timestamp,
    userID: actor.userID,
  });
}
