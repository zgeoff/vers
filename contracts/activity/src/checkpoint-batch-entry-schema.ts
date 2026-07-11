import * as z from 'zod';
import { CheckpointPayloadSchema } from './checkpoint-payload-schema';

/**
 * One checkpoint in a `trackActivityProgress` submission batch, ahead of server-side chain and
 * hash validation.
 */
export const CheckpointBatchEntrySchema = z.object({
  hash: z.string(),
  payload: CheckpointPayloadSchema,
  prevHash: z.string(),
  version: z.int().min(1),
});

export type CheckpointBatchEntry = z.infer<typeof CheckpointBatchEntrySchema>;
