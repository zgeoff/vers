import { encodeProductEventRow } from './encode-product-event-row';
import type { StampedProductEvent } from './types';

interface ProductEventSenderConfig {
  /**
   * The Tinybird Events API origin for the workspace's region, e.g.
   * `https://api.us-east.aws.tinybird.co`.
   */
  readonly url: string;

  /**
   * A token scoped to APPEND on the events data source — never a workspace admin token.
   */
  readonly token: string;
}

/**
 * The name of the Tinybird data source every product event lands in; the repo's Tinybird project
 * defines its schema.
 */
const EVENTS_DATA_SOURCE = 'product_events';
const UPSTREAM_DEADLINE_MS = 15_000;

/**
 * Builds the sender that delivers stamped product events to the Tinybird Events API as NDJSON.
 * Delivery is best-effort: a rejected, non-2xx, or deadline-crossed send resolves `false` and is
 * never retried — analytics loss is acceptable, analytics failing a caller is not. The returned
 * promise settles only once delivery is confirmed or given up, so serverless callers can await it
 * before their process is eligible to stop.
 */
export function makeProductEventSender(
  config: ProductEventSenderConfig,
): (event: StampedProductEvent) => Promise<boolean> {
  const target = new URL('/v0/events', config.url);

  target.searchParams.set('name', EVENTS_DATA_SOURCE);

  return async (event) => {
    const body = JSON.stringify(encodeProductEventRow(event));

    try {
      const response = await Promise.race([
        fetch(target, {
          body,
          headers: {
            authorization: `Bearer ${config.token}`,
            'content-type': 'application/x-ndjson',
          },
          method: 'POST',
        }),
        waitUpstreamDeadline(),
      ]);

      return response.ok;
    } catch {
      return false;
    }
  };
}

/**
 * Rejects once the upstream deadline passes; the timer never keeps the process alive.
 */
function waitUpstreamDeadline(): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('product analytics upstream deadline exceeded'));
    }, UPSTREAM_DEADLINE_MS);

    timer.unref?.();
  });
}
