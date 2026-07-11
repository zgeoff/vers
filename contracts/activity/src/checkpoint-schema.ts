import * as z from 'zod';
import { CheckpointPayloadSchema } from './checkpoint-payload-schema';

/**
 * A persisted checkpoint, as returned to callers (e.g. the verified-head anchor a client resumes
 * from).
 */
export const CheckpointSchema = z.object({
  appendedAt: z.date(),
  hash: z.string(),
  payload: CheckpointPayloadSchema,
  prevHash: z.string(),
  version: z.int(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;
