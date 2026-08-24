import type { ProductEvent } from '@vers/product-analytics';
import { loadSessionActor } from '../rpc/load-session-actor';
import { sendStampedProductEvent } from './send-stamped-product-event';

/**
 * Runs a product-event ingest: resolves the acting session and delivers the event stamped with
 * that identity and the arrival time. An unauthenticated caller's event is dropped — identity
 * comes only from the validated session, never from the payload.
 */
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
