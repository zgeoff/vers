import type { ProductEvent } from '@vers/product-analytics';
import { z } from 'zod';

const activityCompletedProperties = z.object({ activityID: z.string().min(1) });

const activityStartedProperties = z.object({
  activityID: z.string().min(1),
  nodeID: z.string().min(1),
});

const nodeExploredProperties = z.object({ nodeID: z.string().min(1) });
const sessionStartedProperties = z.object({});

/**
 * Validates a client-submitted product event: a registry name paired with exactly that name's
 * properties. Identity fields never appear here — the server stamps user and session from the
 * validated session, so nothing a client sends can claim an identity.
 */
export const productEventSchema: z.ZodType<ProductEvent> = z.discriminatedUnion('name', [
  z.object({ name: z.literal('activity_completed'), properties: activityCompletedProperties }),
  z.object({ name: z.literal('activity_started'), properties: activityStartedProperties }),
  z.object({ name: z.literal('node_explored'), properties: nodeExploredProperties }),
  z.object({ name: z.literal('session_started'), properties: sessionStartedProperties }),
]);
