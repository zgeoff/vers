import { createServerFn } from '@tanstack/react-start';
import { productEventSchema } from './product-event-schema';
import { runProductEventIngest } from './run-product-event-ingest';

/**
 * The product-event ingest action: validates the submitted event against the registry schema and
 * runs the ingest under the caller's session.
 */
export const sendProductEvent = createServerFn({ method: 'POST' })
  .validator((data: unknown) => productEventSchema.parse(data))
  .handler((ctx) => runProductEventIngest(ctx.data));
