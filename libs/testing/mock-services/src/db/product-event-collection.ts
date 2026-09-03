import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

export const ProductEventRowSchema = z.object({
  activity_id: z.string().nullable().default(null),
  datasource: z.string().default('product_events'),
  event_name: z.string(),
  id: z.string().default(() => createId()),
  node_id: z.string().nullable().default(null),
  session_id: z.string().default(''),
  timestamp: z.string().default(''),
  user_id: z.string().default(''),
});

export const productEventCollection = new Collection({ schema: ProductEventRowSchema });
