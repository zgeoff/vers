import { createServerFn } from '@tanstack/react-start';
import { productEventSchema } from './product-event-schema';
import { runProductEventIngest } from './run-product-event-ingest';

export const sendProductEvent = createServerFn({ method: 'POST' })
  .validator((data: unknown) => productEventSchema.parse(data))
  .handler((ctx) => runProductEventIngest(ctx.data));
