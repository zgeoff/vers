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
 * Delivery is best-effort: a rejected, quarantined, non-2xx, or deadline-crossed send resolves
 * `false` and is never retried — analytics loss is acceptable, analytics failing a caller is not.
 * The returned promise settles only once delivery is confirmed or given up, so serverless callers
 * can await it before their process is eligible to stop.
 */
export function makeProductEventSender(
  config: ProductEventSenderConfig,
): (event: StampedProductEvent) => Promise<boolean> {
  const target = new URL('/v0/events', config.url);

  target.searchParams.set('name', EVENTS_DATA_SOURCE);

  return async (event) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // the race bounds the wait rather than aborting the socket: signal instances don't survive
    // environments that patch the fetch globals, and the runtime's pool reclaims the connection
    try {
      const body = JSON.stringify(encodeProductEventRow(event));

      const response = await Promise.race([
        fetch(target, {
          body,
          headers: {
            authorization: `Bearer ${config.token}`,
            'content-type': 'application/x-ndjson',
          },
          method: 'POST',
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error('product analytics upstream deadline exceeded'));
          }, UPSTREAM_DEADLINE_MS);

          timer.unref?.();
        }),
      ]);

      if (!response.ok) {
        return false;
      }

      const quarantinedRows = await readQuarantinedRowCount(response);

      return quarantinedRows === 0;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * The Events API acknowledges with 202 even when rows fail schema validation, reporting them in
 * `quarantined_rows` — a quarantined row never lands in the data source, so it counts as
 * undelivered. An acknowledgement whose body doesn't carry the count reads as zero: the status
 * already said accepted.
 */
async function readQuarantinedRowCount(response: Response): Promise<number> {
  try {
    const payload: unknown = await response.json();

    if (
      payload !== null &&
      typeof payload === 'object' &&
      'quarantined_rows' in payload &&
      typeof payload.quarantined_rows === 'number'
    ) {
      return payload.quarantined_rows;
    }

    return 0;
  } catch {
    return 0;
  }
}
