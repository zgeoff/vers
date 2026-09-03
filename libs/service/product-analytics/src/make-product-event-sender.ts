import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { encodeProductEventRow } from './encode-product-event-row';
import { recordDeliveryFailure } from './metrics/record-delivery-failure';
import type { StampedProductEvent } from './types';

interface ProductEventSenderConfig {
  readonly url: string;

  readonly token: string;
}

const EVENTS_DATA_SOURCE = 'product_events';
const UPSTREAM_DEADLINE_MS = 15_000;

export function makeProductEventSender(
  config: ProductEventSenderConfig,
): (event: StampedProductEvent) => Promise<boolean> {
  const target = new URL('/v0/events', config.url);

  target.searchParams.set('name', EVENTS_DATA_SOURCE);

  return (event) => {
    const tracer = trace.getTracer('@vers/product-analytics');

    return tracer.startActiveSpan('tinybird.events', { kind: SpanKind.CLIENT }, async (span) => {
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
          span.setStatus({ code: SpanStatusCode.ERROR });

          recordDeliveryFailure('rejected');

          return false;
        }

        const quarantinedRows = await readQuarantinedRowCount(response);

        if (quarantinedRows !== 0) {
          span.setStatus({ code: SpanStatusCode.ERROR });

          recordDeliveryFailure('quarantined');

          return false;
        }

        return true;
      } catch (error) {
        const exception = error instanceof Error ? error : String(error);

        span.recordException(exception);
        span.setStatus({ code: SpanStatusCode.ERROR });

        recordDeliveryFailure('unreachable');

        return false;
      } finally {
        clearTimeout(timer);

        span.end();
      }
    });
  };
}

// the Events API acknowledges with 202 even when rows fail schema validation, reporting them in
// quarantined_rows; a quarantined row never lands, so it counts as undelivered
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
